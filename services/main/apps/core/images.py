"""Image validation and metadata-stripping helpers for uploads."""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
from typing import Final

from PIL import Image, ImageOps, UnidentifiedImageError

ACCEPTED_IMAGE_TYPES: Final[dict[str, str]] = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}
FORMAT_TO_CONTENT_TYPE: Final[dict[str, str]] = {value: key for key, value in ACCEPTED_IMAGE_TYPES.items()}
MAX_UPLOAD_BYTES: Final[int] = 5 * 1024 * 1024
MIN_WIDTH: Final[int] = 300
MIN_HEIGHT: Final[int] = 300
MAX_WIDTH: Final[int] = 5000
MAX_HEIGHT: Final[int] = 5000


class ImageValidationError(ValueError):
    """Raised when an uploaded image is invalid or cannot be safely normalized."""

    def __init__(self, message: str, *, code: str = "invalid_image") -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True, slots=True)
class NormalizedImage:
    content: bytes = field(repr=False)
    content_type: str
    format_name: str
    width: int
    height: int
    size_bytes: int


def detect_image_content_type(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_content_type(content: bytes, declared_content_type: str | None) -> str:
    detected = detect_image_content_type(content)
    if detected not in ACCEPTED_IMAGE_TYPES:
        msg = "Uploaded file must be a JPEG, PNG, or WebP image."
        raise ImageValidationError(msg, code="unsupported_image_type")

    if declared_content_type:
        normalized_declared = declared_content_type.split(";", 1)[0].strip().lower()
        if normalized_declared not in ACCEPTED_IMAGE_TYPES:
            msg = "Declared content type is not supported."
            raise ImageValidationError(msg, code="unsupported_image_type")
        if normalized_declared != detected:
            msg = "Declared content type does not match the image signature."
            raise ImageValidationError(msg, code="content_type_mismatch")

    return detected


def validate_image_size(content: bytes, *, max_bytes: int = MAX_UPLOAD_BYTES) -> None:
    if not content:
        raise ImageValidationError("Uploaded image is empty.", code="empty_file")
    if len(content) > max_bytes:
        raise ImageValidationError("Uploaded image exceeds the maximum size.", code="file_too_large")


def validate_dimensions(
    width: int,
    height: int,
    *,
    min_width: int = MIN_WIDTH,
    min_height: int = MIN_HEIGHT,
    max_width: int = MAX_WIDTH,
    max_height: int = MAX_HEIGHT,
) -> None:
    if width < min_width or height < min_height:
        raise ImageValidationError("Image dimensions are below the minimum.", code="dimensions_too_small")
    if width > max_width or height > max_height:
        raise ImageValidationError("Image dimensions exceed the maximum.", code="dimensions_too_large")


def open_verified_image(content: bytes) -> Image.Image:
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
        image = Image.open(BytesIO(content))
        image.load()
    except (OSError, UnidentifiedImageError) as exc:
        raise ImageValidationError(
            "Uploaded file could not be parsed as an image.",
            code="image_unreadable",
        ) from exc
    return image


def strip_metadata_and_rewrite(image: Image.Image, format_name: str) -> bytes:
    try:
        normalized = ImageOps.exif_transpose(image)
        output = BytesIO()

        if format_name == "JPEG":
            if normalized.mode not in {"RGB", "L"}:
                normalized = normalized.convert("RGB")
            normalized.save(output, format="JPEG", quality=95, optimize=True)
        elif format_name == "PNG":
            normalized.save(output, format="PNG", optimize=True)
        elif format_name == "WEBP":
            normalized.save(output, format="WEBP", lossless=True, quality=95)
        else:
            raise ImageValidationError("Unsupported image format.", code="unsupported_image_type")
    except ImageValidationError:
        raise
    except OSError as exc:
        raise ImageValidationError(
            "Uploaded image could not be safely rewritten.",
            code="safe_rewrite_failed",
        ) from exc

    return output.getvalue()


def validate_normalized_metadata(content: bytes) -> None:
    try:
        with Image.open(BytesIO(content)) as image:
            metadata_keys = {key.lower() for key in image.info}
            forbidden = {"exif", "xmp", "xml", "photoshop", "icc_profile", "comment"}
            if metadata_keys.intersection(forbidden):
                raise ImageValidationError(
                    "Normalized image still contains forbidden metadata.",
                    code="metadata_not_stripped",
                )
    except ImageValidationError:
        raise
    except (OSError, UnidentifiedImageError) as exc:
        raise ImageValidationError(
            "Normalized image could not be parsed.",
            code="normalized_image_unreadable",
        ) from exc


def validate_and_normalize_image(
    content: bytes,
    declared_content_type: str | None = None,
    *,
    max_bytes: int = MAX_UPLOAD_BYTES,
    min_width: int = MIN_WIDTH,
    min_height: int = MIN_HEIGHT,
    max_width: int = MAX_WIDTH,
    max_height: int = MAX_HEIGHT,
) -> NormalizedImage:
    validate_image_size(content, max_bytes=max_bytes)
    content_type = validate_content_type(content, declared_content_type)
    format_name = ACCEPTED_IMAGE_TYPES[content_type]

    image = open_verified_image(content)
    width, height = image.size
    validate_dimensions(
        width,
        height,
        min_width=min_width,
        min_height=min_height,
        max_width=max_width,
        max_height=max_height,
    )

    normalized_content = strip_metadata_and_rewrite(image, format_name)
    validate_image_size(normalized_content, max_bytes=max_bytes)

    normalized_image = open_verified_image(normalized_content)
    normalized_width, normalized_height = normalized_image.size
    validate_dimensions(
        normalized_width,
        normalized_height,
        min_width=min_width,
        min_height=min_height,
        max_width=max_width,
        max_height=max_height,
    )
    validate_normalized_metadata(normalized_content)

    normalized_content_type = FORMAT_TO_CONTENT_TYPE.get(
        normalized_image.format or format_name,
        content_type,
    )
    if normalized_content_type != content_type:
        raise ImageValidationError(
            "Normalized image did not preserve its accepted format family.",
            code="format_family_changed",
        )

    return NormalizedImage(
        content=normalized_content,
        content_type=content_type,
        format_name=format_name,
        width=normalized_width,
        height=normalized_height,
        size_bytes=len(normalized_content),
    )
