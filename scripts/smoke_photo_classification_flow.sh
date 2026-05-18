#!/usr/bin/env bash
set -euo pipefail

COMPOSE="${COMPOSE:-docker compose}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
BASE_URL="${BASE_URL:-http://nginx}"
PUBLIC_HOST="${PUBLIC_HOST:-localhost}"
PUBLIC_URL="${PUBLIC_URL:-http://localhost}"
SMOKE_CLEANUP="${SMOKE_CLEANUP:-1}"

if [ "${SMOKE_SKIP_BOOT:-0}" != "1" ]; then
  $COMPOSE up -d --build
fi

cleanup() {
  if [ "$SMOKE_CLEANUP" = "1" ] && [ "${SMOKE_SKIP_BOOT:-0}" != "1" ]; then
    $COMPOSE down -v
  fi
}
trap cleanup EXIT

$COMPOSE exec -T web python manage.py migrate --noinput

$COMPOSE exec -T web python - <<'PY'
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()
admin, _ = User.objects.get_or_create(
    username="smoke-admin",
    defaults={"email": "smoke-admin@example.com", "is_staff": True, "is_superuser": True},
)
admin.email = "smoke-admin@example.com"
admin.is_staff = True
admin.is_superuser = True
admin.set_password("StrongPassword123!")
admin.save()
PY

$COMPOSE exec -T web env BASE_URL="$BASE_URL" PUBLIC_HOST="$PUBLIC_HOST" python - <<'PY'
import json
import os
import time
import uuid
import urllib.error
import urllib.request
from io import BytesIO

from PIL import Image

BASE_URL = os.environ["BASE_URL"].rstrip("/")
PUBLIC_HOST = os.environ["PUBLIC_HOST"]


def request(method, path, *, body=None, headers=None, timeout=20):
    request_headers = {"Host": PUBLIC_HOST}
    request_headers.update(headers or {})
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body,
        headers=request_headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            payload = response.read()
            if response.headers.get("content-type", "").startswith("application/json"):
                return response.status, json.loads(payload.decode("utf-8"))
            return response.status, payload.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise AssertionError(f"{method} {path} failed with {exc.code}: {detail}") from exc


def json_body(payload):
    return json.dumps(payload).encode("utf-8"), {"Content-Type": "application/json"}


def multipart_body(fields, files):
    boundary = f"----photo-smoke-{uuid.uuid4().hex}"
    chunks = []
    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        chunks.append(str(value).encode())
        chunks.append(b"\r\n")
    for name, filename, content_type, content in files:
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(
            (
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                f"Content-Type: {content_type}\r\n\r\n"
            ).encode(),
        )
        chunks.append(content)
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), {"Content-Type": f"multipart/form-data; boundary={boundary}"}


def smoke_image():
    image = Image.new("RGB", (320, 320), color=(40, 100, 160))
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


run_id = uuid.uuid4().hex[:10]
email = f"smoke-{run_id}@example.com"
username = f"smoke-{run_id}"

body, headers = json_body(
    {"email": email, "username": username, "password": "StrongPassword123!"},
)
status, registered = request("POST", "/api/auth/register/", body=body, headers=headers)
assert status == 201, registered
assert registered["is_staff"] is False

body, headers = json_body({"email": email, "password": "StrongPassword123!"})
status, login = request("POST", "/api/auth/login/", body=body, headers=headers)
assert status == 200, login
token = login["access"]

fields = {
    "name": "Smoke Candidate",
    "age": "29",
    "place_of_living": "Berlin",
    "gender": "non_binary",
    "country_of_origin": "Germany",
    "description": "Smoke test submission.",
}
body, headers = multipart_body(
    fields,
    [("photo", "smoke.jpg", "image/jpeg", smoke_image())],
)
headers["Authorization"] = f"Bearer {token}"
status, submission = request("POST", "/api/submissions/", body=body, headers=headers, timeout=30)
assert status == 201, submission
assert submission["status"] == "pending_classification"
assert submission["classification"] is None
submission_id = submission["id"]

detail = None
for _ in range(40):
    status, detail = request(
        "GET",
        f"/api/submissions/{submission_id}/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status == 200, detail
    if detail["status"] in {"classified", "needs_manual_review", "rejected", "classification_failed"}:
        break
    time.sleep(2)
else:
    raise AssertionError(f"submission {submission_id} did not finish classification: {detail}")

classification = detail["classification"]
assert classification is not None, detail
assert classification["classification_type"] == "submission_review"
classification_text = json.dumps(classification).lower()
for forbidden in (
    "raw_response",
    "provider_metadata",
    "ethnicity",
    "race",
    "attractiveness",
    "identity",
    "trustworthiness",
    "desirability",
):
    assert forbidden not in classification_text, classification_text
PY

$COMPOSE exec -T web python - <<'PY'
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from apps.classification.models import ClassificationResult
from apps.classification.tasks import process_classification_job_payload
from apps.submissions.models import Submission

submission = Submission.objects.filter(name="Smoke Candidate").latest("created_at")
job = submission.classification_jobs.first()
before = ClassificationResult.objects.filter(submission=submission).count()
assert Submission in admin.site._registry
assert ClassificationResult in admin.site._registry

admin_user = get_user_model().objects.get(username="smoke-admin")
admin_client = Client(HTTP_HOST="localhost")
admin_client.force_login(admin_user)
changelist = admin_client.get(
    reverse("admin:submissions_submission_changelist"),
    {"q": "Smoke Candidate"},
)
assert changelist.status_code == 200, changelist.status_code
assert b"Smoke Candidate" in changelist.content

change_page = admin_client.get(
    reverse("admin:submissions_submission_change", args=[submission.pk]),
)
assert change_page.status_code == 200, change_page.status_code
assert b"Smoke Candidate" in change_page.content
assert b"raw_response" not in change_page.content
assert b"provider_metadata" not in change_page.content
if job is not None:
    duplicate = process_classification_job_payload(dict(job.payload))
    assert duplicate.status in {"duplicate", "skipped"}
after = ClassificationResult.objects.filter(submission=submission).count()
assert after == before
PY

$COMPOSE exec -T web python - <<'PY'
import json
import urllib.request

with urllib.request.urlopen("http://classifier:8001/health", timeout=10) as response:
    payload = json.loads(response.read().decode("utf-8"))

assert payload["service"] == "classification-api"
assert payload["provider"] == "rule_based"
PY

if curl -fsS "$PUBLIC_URL/classify" >/dev/null 2>&1; then
  echo "Classifier endpoint is publicly reachable through nginx; expected it to be private." >&2
  exit 1
fi

$COMPOSE config --format json | "$PYTHON_BIN" -c '
import json
import sys

config = json.load(sys.stdin)
classifier = config["services"]["classifier"]
if classifier.get("ports"):
    raise SystemExit("classifier publishes host ports")
'

echo "Smoke flow passed."
