from io import BytesIO
from uuid import uuid4

import httpx
from PIL import Image

image = Image.new("RGB", (320, 320), color=(30, 90, 150))
buf = BytesIO()
image.save(buf, format="JPEG")
content = buf.getvalue()

files = {
    "file": ("phase7-valid.jpg", content, "image/jpeg"),
}

data = {
    "submission_id": str(uuid4()),
    "metadata_complete": "true",
    "content_type": "image/jpeg",
    "size_bytes": str(len(content)),
}

r = httpx.post(
    "http://classifier:8001/classify",
    files=files,
    data=data,
    timeout=10,
)

print("status:", r.status_code)
print(r.text)
