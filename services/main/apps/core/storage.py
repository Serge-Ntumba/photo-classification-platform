"""S3-compatible object storage wrapper."""

from __future__ import annotations

import os
from dataclasses import dataclass
from uuid import UUID


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class S3StorageSettings:
    endpoint_url: str
    access_key_id: str
    secret_access_key: str
    bucket_name: str
    region_name: str = "us-east-1"
    use_ssl: bool = False

    @classmethod
    def from_environment(cls) -> "S3StorageSettings":
        return cls(
            endpoint_url=os.getenv("S3_ENDPOINT_URL", "http://minio:9000"),
            access_key_id=os.getenv("S3_ACCESS_KEY_ID", ""),
            secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY", ""),
            bucket_name=os.getenv("S3_BUCKET_NAME", "photo-submissions"),
            region_name=os.getenv("S3_REGION_NAME", "us-east-1"),
            use_ssl=env_bool("S3_USE_SSL", False),
        )


class ObjectStorageClient:
    """Small wrapper around boto3 that keeps object operations centralized."""

    def __init__(self, settings: S3StorageSettings | None = None) -> None:
        self.settings = settings or S3StorageSettings.from_environment()
        self._client = None

    @property
    def client(self):
        if self._client is None:
            import boto3

            self._client = boto3.client(
                "s3",
                endpoint_url=self.settings.endpoint_url,
                aws_access_key_id=self.settings.access_key_id,
                aws_secret_access_key=self.settings.secret_access_key,
                region_name=self.settings.region_name,
                use_ssl=self.settings.use_ssl,
            )
        return self._client

    def upload_bytes(self, *, key: str, content: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.settings.bucket_name,
            Key=key,
            Body=content,
            ContentType=content_type,
            ACL="private",
        )

    def get_bytes(self, *, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.settings.bucket_name, Key=key)
        return response["Body"].read()

    def delete_object(self, *, key: str) -> None:
        self.client.delete_object(Bucket=self.settings.bucket_name, Key=key)


def build_submission_object_key(submission_id: UUID | str, filename: str) -> str:
    safe_filename = os.path.basename(filename).replace(" ", "_") or "upload"
    return f"uploads/submissions/{submission_id}/{safe_filename}"
