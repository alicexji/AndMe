import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ObservationType(str, enum.Enum):
    INTENTIONAL = "INTENTIONAL"
    # Retained only so databases containing earlier prototype rows remain readable.
    SAMPLED = "SAMPLED"
    RETROSPECTIVE = "RETROSPECTIVE"


class HumanObservation(Base):
    __tablename__ = "human_observations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    timezone_context: Mapped[str] = mapped_column(String(64))
    observation_type: Mapped[ObservationType] = mapped_column(Enum(ObservationType), index=True)
    source: Mapped[str] = mapped_column(String(32), default="apple_shortcuts")
    raw_text: Mapped[str] = mapped_column(Text, default="")
    context: Mapped[dict] = mapped_column(JSON, default=dict)
    media: Mapped[list["MediaAsset"]] = relationship(back_populates="observation")


class MediaAsset(Base):
    __tablename__ = "media_assets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    observation_id: Mapped[str] = mapped_column(String(36), ForeignKey("human_observations.id"), index=True)
    provider_url: Mapped[str] = mapped_column(Text)
    media_type: Mapped[str] = mapped_column(String(128))
    storage_key: Mapped[str] = mapped_column(String(512), unique=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    byte_count: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    observation: Mapped[HumanObservation] = relationship(back_populates="media")


class MachineEvent(Base):
    __tablename__ = "machine_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    source: Mapped[str] = mapped_column(String(64), index=True)
    metric: Mapped[str] = mapped_column(String(128), index=True)
    value: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(32))
    raw_payload: Mapped[dict] = mapped_column(JSON, default=dict)
