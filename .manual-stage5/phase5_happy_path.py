import json
import time
import uuid
from io import BytesIO

import httpx
from PIL import Image

base = "http://127.0.0.1:8000"
email = f"phase5-{uuid.uuid4().hex[:8]}@example.com"
username = f"phase5_{uuid.uuid4().hex[:8]}"
password = "Phase5TestPass123!"

client = httpx.Client(base_url=base, timeout=10)

r = client.post("/api/auth/register/", json={
    "email": email,
    "username": username,
    "password": password,
})
print("REGISTER", r.status_code)
print(json.dumps(r.json(), indent=2))

r = client.post("/api/auth/login/", json={
    "email": email,
    "password": password,
})
print("LOGIN", r.status_code)
login_payload = r.json()
print(json.dumps({
    "user": login_payload.get("user"),
    "has_access": bool(login_payload.get("access")),
}, indent=2))

token = login_payload["access"]

image = Image.new("RGB", (320, 320), color=(20, 80, 140))
buf = BytesIO()
image.save(buf, format="JPEG")
content = buf.getvalue()

r = client.post(
    "/api/submissions/",
    headers={"Authorization": f"Bearer {token}"},
    data={
        "name": "Phase Five Test",
        "age": "28",
        "place_of_living": "Berlin",
        "gender": "non_binary",
        "country_of_origin": "Germany",
        "description": "phase 5 manual verification",
    },
    files={"photo": ("phase5.jpg", content, "image/jpeg")},
)
print("CREATE", r.status_code)
created = r.json()
print(json.dumps(created, indent=2))

submission_id = created["id"]

for attempt in range(20):
    time.sleep(1)
    r = client.get(
        f"/api/submissions/{submission_id}/",
        headers={"Authorization": f"Bearer {token}"},
    )
    payload = r.json()
    print(f"POLL {attempt + 1}: status={payload.get('status')}")

    if payload.get("classification") is not None:
        print("FINAL", r.status_code)
        print(json.dumps(payload, indent=2))
        break
else:
    print("TIMED_OUT")
