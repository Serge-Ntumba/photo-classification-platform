from __future__ import annotations

from io import BytesIO

import pytest
from PIL import Image
from PIL.PngImagePlugin import PngInfo

from apps.core.images import ImageValidationError, validate_and_normalize_image


def make_image(
    format_name: str,
    *,
    size: tuple[int, int] = (320, 320),
    metadata: bool = False,
) -> bytes:
    image = Image.new("RGB", size, color=(120, 80, 40))
    output = BytesIO()
    if format_name == "JPEG" and metadata:
        exif = image.getexif()
        exif[0x010E] = "private description"
        image.save(output, format=format_name, exif=exif.tobytes())
    elif format_name == "PNG" and metadata:
        pnginfo = PngInfo()
        pnginfo.add_text("Comment", "private application metadata")
        image.save(output, format=format_name, pnginfo=pnginfo)
    else:
        image.save(output, format=format_name)
    return output.getvalue()


def read_info(content: bytes) -> dict[str, object]:
    with Image.open(BytesIO(content)) as image:
        return dict(image.info)


def test_normalization_strips_jpeg_exif_metadata() -> None:
    normalized = validate_and_normalize_image(make_image("JPEG", metadata=True), "image/jpeg")

    assert normalized.content_type == "image/jpeg"
    assert "exif" not in {key.lower() for key in read_info(normalized.content)}


def test_normalization_strips_png_application_metadata() -> None:
    normalized = validate_and_normalize_image(make_image("PNG", metadata=True), "image/png")

    assert normalized.content_type == "image/png"
    assert "comment" not in {key.lower() for key in read_info(normalized.content)}


@pytest.mark.parametrize(
    ("format_name", "content_type"),
    [
        ("JPEG", "image/jpeg"),
        ("PNG", "image/png"),
        ("WEBP", "image/webp"),
    ],
)
def test_normalization_preserves_accepted_format_family(
    format_name: str,
    content_type: str,
) -> None:
    normalized = validate_and_normalize_image(make_image(format_name), content_type)

    assert normalized.content_type == content_type
    assert normalized.format_name == format_name
    assert normalized.width == 320
    assert normalized.height == 320


def test_dimension_validation_runs_after_rewrite() -> None:
    normalized = validate_and_normalize_image(
        make_image("JPEG", size=(400, 400)),
        "image/jpeg",
        min_width=300,
        min_height=300,
        max_width=500,
        max_height=500,
    )

    assert normalized.width == 400
    assert normalized.height == 400


def test_rejects_dimensions_outside_policy() -> None:
    with pytest.raises(ImageValidationError, match="minimum") as exc_info:
        validate_and_normalize_image(make_image("JPEG", size=(299, 320)), "image/jpeg")

    assert exc_info.value.code == "dimensions_too_small"


def test_rejects_spoofed_content_type() -> None:
    with pytest.raises(ImageValidationError) as exc_info:
        validate_and_normalize_image(make_image("JPEG"), "image/png")

    assert exc_info.value.code == "content_type_mismatch"


def test_rejects_safe_rewrite_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    content = make_image("JPEG")

    def fail_save(*_args, **_kwargs) -> None:
        raise OSError("cannot rewrite")

    monkeypatch.setattr(Image.Image, "save", fail_save)

    with pytest.raises(ImageValidationError) as exc_info:
        validate_and_normalize_image(content, "image/jpeg")

    assert exc_info.value.code == "safe_rewrite_failed"
