"""Read-only, reproducible metadata for the paired portrait; originals stay untouched."""
from functools import lru_cache
import re

from PIL import Image, ExifTags


@lru_cache(maxsize=2048)
def image_metadata(path: str, digest: str) -> dict:
    try:
        with Image.open(path) as image:
            exif = image.getexif()
            fields = {ExifTags.TAGS.get(key, str(key)): str(value)
                      for key, value in exif.items() if not isinstance(value, bytes)}
            # Camera capture fields are often stored in the nested EXIF IFD.
            if 34665 in exif:
                fields.update({ExifTags.TAGS.get(key, str(key)): str(value)
                               for key, value in exif.get_ifd(34665).items()
                               if not isinstance(value, bytes)})
            if 34853 in exif:
                fields['GPSInfo'] = {ExifTags.GPSTAGS.get(key, str(key)): str(value)
                                     for key, value in exif.get_ifd(34853).items()}
            return {"status": "available", "width": image.width, "height": image.height,
                    "format": image.format, "mode": image.mode, "exif": fields}
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        return {"status": "unavailable"}


def metadata(item, settings) -> dict:
    words = re.findall(r"\b\w+\b", item.raw_text, flags=re.UNICODE)
    media = []
    for asset in item.media:
        path = (settings.media_root / asset.storage_key).resolve()
        root = settings.media_root.resolve()
        details = image_metadata(str(path), asset.sha256) if path.is_relative_to(root) and path.is_file() else {"status": "unavailable"}
        media.append({"id": asset.id, "media_type": asset.media_type,
                      "byte_count": asset.byte_count, "sha256": asset.sha256, **details})
    return {"source": item.source, "timezone_context": item.timezone_context,
            "created_at": item.created_at, "context": item.context,
            "character_count": len(item.raw_text), "word_count": len(words),
            "media_count": len(media), "media_bytes": sum(m.byte_count for m in item.media),
            "media": media}
