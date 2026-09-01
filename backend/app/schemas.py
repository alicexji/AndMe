from datetime import datetime

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ObservationCreate(BaseModel):
    type: Literal["INTENTIONAL"] = "INTENTIONAL"
    text: str = Field(min_length=1)
    observed_at: datetime | None = None

    @field_validator("observed_at")
    @classmethod
    def observed_at_must_include_timezone(cls, value: datetime | None):
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("observed_at must include a UTC offset")
        return value


class MediaOut(BaseModel):
    id: str
    media_type: str
    url: str
    byte_count: int


class ObservationOut(BaseModel):
    id: str
    received_at: datetime
    local_time: str
    observation_type: str
    raw_text: str
    media: list[MediaOut]


class DayOut(BaseModel):
    date: str
    timezone: str
    observations: list[ObservationOut]

