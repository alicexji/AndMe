import mimetypes
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .auth import require_ingestion_key
from .config import Settings, get_settings
from .db import get_db
from .media import LocalMediaStore
from .models import HumanObservation, MediaAsset, ObservationType
from .schemas import DayOut, MediaOut, ObservationCreate, ObservationOut

router = APIRouter(prefix="/api")


def observation_out(item: HumanObservation, settings: Settings) -> ObservationOut:
    zone = ZoneInfo(settings.app_timezone)
    received_at = item.received_at
    if received_at.tzinfo is None:
        received_at = received_at.replace(tzinfo=timezone.utc)
    local = received_at.astimezone(zone)
    local_time = (local.strftime("%-I:%M %p") if not __import__('sys').platform.startswith('win')
                  else local.strftime("%I:%M %p").lstrip("0"))
    return ObservationOut(
        id=item.id, received_at=received_at, local_time=local_time,
        observation_type=item.observation_type.value, raw_text=item.raw_text,
        media=[MediaOut(id=media.id, media_type=media.media_type,
                        url=f"{settings.public_base_url.rstrip('/')}/media/{media.storage_key}",
                        byte_count=media.byte_count) for media in item.media])


@router.post("/observations", response_model=ObservationOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_ingestion_key)])
def create_observation(payload: ObservationCreate, db: Session = Depends(get_db),
                       settings: Settings = Depends(get_settings)):
    observed_at = (payload.observed_at or datetime.now(timezone.utc)).astimezone(timezone.utc)
    observation = HumanObservation(
        received_at=observed_at, timezone_context=settings.app_timezone,
        observation_type=ObservationType.INTENTIONAL, source="apple_shortcuts", raw_text=payload.text,
        context={"submitted_observed_at": payload.observed_at.isoformat() if payload.observed_at else None})
    db.add(observation)
    db.commit()
    db.refresh(observation)
    return observation_out(observation, settings)


@router.post("/observations/photo", response_model=ObservationOut,
             status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_ingestion_key)])
async def create_photo_observation(
    photo: UploadFile = File(...), text: str = Form(default=""),
    observed_at: datetime | None = Form(default=None), db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    if observed_at is not None and (observed_at.tzinfo is None or observed_at.utcoffset() is None):
        raise HTTPException(status_code=422, detail="observed_at must include a UTC offset")
    media_type = photo.content_type or mimetypes.guess_type(photo.filename or "")[0] or "application/octet-stream"
    if not media_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="photo must be an image")
    content = await photo.read()
    if not content:
        raise HTTPException(status_code=422, detail="photo is empty")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="photo exceeds the 25 MB limit")
    captured_at = (observed_at or datetime.now(timezone.utc)).astimezone(timezone.utc)
    observation = HumanObservation(
        received_at=captured_at, timezone_context=settings.app_timezone,
        observation_type=ObservationType.INTENTIONAL, source="apple_shortcuts", raw_text=text,
        context={"submitted_observed_at": observed_at.isoformat() if observed_at else None,
                 "original_filename": photo.filename})
    db.add(observation)
    db.flush()
    extension = mimetypes.guess_extension(media_type) or ".bin"
    key, byte_count, digest = LocalMediaStore(settings.media_root).put(
        f"{captured_at:%Y/%m/%d}/{observation.id}{extension}", content)
    db.add(MediaAsset(observation_id=observation.id, provider_url=f"upload://{photo.filename or 'photo'}",
                      media_type=media_type, storage_key=key, received_at=datetime.now(timezone.utc),
                      byte_count=byte_count, sha256=digest))
    db.commit()
    observation = db.scalar(select(HumanObservation).options(selectinload(HumanObservation.media))
                            .where(HumanObservation.id == observation.id))
    return observation_out(observation, settings)


@router.get("/days/{day}/observations", response_model=DayOut)
def observations_for_day(day: date, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    zone = ZoneInfo(settings.app_timezone)
    start = datetime.combine(day, time.min, zone).astimezone(timezone.utc)
    end = datetime.combine(day, time.max, zone).astimezone(timezone.utc)
    observations = db.scalars(select(HumanObservation).options(selectinload(HumanObservation.media))
                              .where(HumanObservation.received_at >= start, HumanObservation.received_at <= end)
                              .order_by(HumanObservation.received_at)).all()
    output = [observation_out(item, settings) for item in observations]
    return DayOut(date=day.isoformat(), timezone=settings.app_timezone, observations=output)

