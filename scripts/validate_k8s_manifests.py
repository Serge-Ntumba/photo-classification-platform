#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
K8S_DIR = ROOT / "infra" / "k8s"
PRIVATE_SERVICE_NAMES = {"classifier", "postgres", "rabbitmq", "minio"}
PUBLIC_BACKENDS = {"nginx", "web"}
FORBIDDEN_CLASSIFIER_ENV_PREFIXES = (
    "DATABASE",
    "POSTGRES_",
    "S3_",
    "MINIO_",
    "CELERY_",
    "RABBITMQ_",
)
FORBIDDEN_CLASSIFIER_ENV_NAMES = {
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "SECRET_KEY",
    "DJANGO_SECRET_KEY",
    "JWT_SIGNING_KEY",
}


def main() -> int:
    documents = list(_manifest_documents())
    if not documents:
        raise SystemExit("No Kubernetes manifests found under infra/k8s.")

    _require_kinds(documents)
    _validate_services(documents)
    _validate_ingress(documents)
    _validate_classifier_boundary(documents)
    _validate_secret_placeholders(documents)
    print(f"Validated {len(documents)} Kubernetes manifest document(s).")
    return 0


def _manifest_documents() -> list[tuple[Path, str]]:
    docs: list[tuple[Path, str]] = []
    for path in sorted(K8S_DIR.rglob("*.yaml")):
        text = path.read_text(encoding="utf-8")
        for raw_doc in re.split(r"^---\s*$", text, flags=re.MULTILINE):
            doc = raw_doc.strip()
            if doc:
                docs.append((path, doc))
    return docs


def _field(doc: str, field: str) -> str | None:
    match = re.search(rf"^{re.escape(field)}:\s*([A-Za-z0-9_.-]+)\s*$", doc, re.MULTILINE)
    return match.group(1) if match else None


def _metadata_name(doc: str) -> str | None:
    match = re.search(
        r"^metadata:\s*\n(?:  .+\n)*?  name:\s*([A-Za-z0-9_.-]+)\s*$",
        doc,
        re.MULTILINE,
    )
    return match.group(1) if match else None


def _require_kinds(documents: list[tuple[Path, str]]) -> None:
    kinds = {_field(doc, "kind") for _, doc in documents}
    required = {"Namespace", "ConfigMap", "Secret", "Deployment", "Service", "Ingress", "Job"}
    missing = sorted(required - kinds)
    if missing:
        raise SystemExit(f"Missing required Kubernetes manifest kinds: {missing}")


def _validate_services(documents: list[tuple[Path, str]]) -> None:
    service_names: set[str] = set()
    for path, doc in documents:
        if _field(doc, "kind") != "Service":
            continue
        name = _metadata_name(doc)
        service_names.add(name or "")
        service_type = _service_type(doc)
        if name in PRIVATE_SERVICE_NAMES and service_type != "ClusterIP":
            raise SystemExit(f"{path}: private service {name!r} must be ClusterIP.")
        if service_type in {"NodePort", "LoadBalancer"}:
            raise SystemExit(f"{path}: service {name!r} must not publish directly.")

    missing = sorted(PRIVATE_SERVICE_NAMES - service_names)
    if missing:
        raise SystemExit(f"Missing private service manifests: {missing}")


def _service_type(doc: str) -> str:
    match = re.search(r"^\s+type:\s*([A-Za-z0-9_.-]+)\s*$", doc, re.MULTILINE)
    return match.group(1) if match else "ClusterIP"


def _validate_ingress(documents: list[tuple[Path, str]]) -> None:
    for path, doc in documents:
        if _field(doc, "kind") != "Ingress":
            continue
        for private_name in PRIVATE_SERVICE_NAMES:
            if re.search(rf"\bname:\s*{re.escape(private_name)}\b", doc):
                raise SystemExit(
                    f"{path}: ingress must not route to private service {private_name}.",
                )
        if not any(re.search(rf"\bname:\s*{backend}\b", doc) for backend in PUBLIC_BACKENDS):
            raise SystemExit(f"{path}: ingress must route only to nginx or web.")


def _validate_classifier_boundary(documents: list[tuple[Path, str]]) -> None:
    for path, doc in documents:
        if _field(doc, "kind") != "Deployment" or _metadata_name(doc) != "classifier":
            continue
        env_names = set(re.findall(r"^\s+-\s+name:\s*([A-Z0-9_]+)\s*$", doc, re.MULTILINE))
        forbidden = sorted(
            name
            for name in env_names
            if name in FORBIDDEN_CLASSIFIER_ENV_NAMES
            or any(name.startswith(prefix) for prefix in FORBIDDEN_CLASSIFIER_ENV_PREFIXES)
        )
        if forbidden:
            raise SystemExit(f"{path}: classifier receives forbidden env vars: {forbidden}")
        if "envFrom:" in doc:
            raise SystemExit(
                f"{path}: classifier must not use broad envFrom secret/config imports.",
            )


def _validate_secret_placeholders(documents: list[tuple[Path, str]]) -> None:
    for path, doc in documents:
        if _field(doc, "kind") != "Secret":
            continue
        if "change-me" not in doc:
            raise SystemExit(f"{path}: secret manifest must use placeholder values only.")


if __name__ == "__main__":
    raise SystemExit(main())
