from datetime import datetime, timezone

from sqlalchemy import select

from app.db import SessionLocal
from app.models import HumanObservation, MachineEvent, MediaAsset, ObservationType

AUTH = {"Authorization": "Bearer test-secret-key"}


def test_ingestion_requires_bearer_key(client):
    payload = {"type": "INTENTIONAL", "text": "unprotected"}
    assert client.post("/api/observations", json=payload).status_code == 401
    assert client.post("/api/observations", json=payload,
                       headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_text_and_supplied_time_are_preserved(client):
    text = "  The clouds look strangely flat today.\n"
    response = client.post("/api/observations", headers=AUTH, json={
        "type": "INTENTIONAL", "text": text,
        "observed_at": "2026-08-31T15:42:00-04:00",
    })
    assert response.status_code == 201
    assert response.json()["raw_text"] == text
    with SessionLocal() as db:
        observation = db.scalar(select(HumanObservation))
        assert observation.raw_text == text
        assert observation.observation_type == ObservationType.INTENTIONAL
        assert observation.source == "apple_shortcuts"
        assert observation.context["submitted_observed_at"] == "2026-08-31T15:42:00-04:00"
        stored = observation.received_at.replace(tzinfo=timezone.utc) if observation.received_at.tzinfo is None else observation.received_at
        assert stored == datetime(2026, 8, 31, 19, 42, tzinfo=timezone.utc)


def test_type_can_be_omitted_but_other_collection_modes_are_rejected(client):
    response = client.post("/api/observations", headers=AUTH, json={"text": "A remembered detail."})
    assert response.status_code == 201
    rejected = client.post("/api/observations", headers=AUTH, json={
        "type": "RETROSPECTIVE", "text": "Old mode",
    })
    assert rejected.status_code == 422


def test_photo_and_optional_text_are_preserved(client):
    raw_photo = b"not-a-real-jpeg-but-preserved-byte-for-byte"
    response = client.post(
        "/api/observations/photo", headers=AUTH,
        data={"text": "  The light on this wall. ",
              "observed_at": "2026-08-31T16:05:00-04:00"},
        files={"photo": ("light.jpg", raw_photo, "image/jpeg")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["observation_type"] == "INTENTIONAL"
    assert body["raw_text"] == "  The light on this wall. "
    assert len(body["media"]) == 1
    with SessionLocal() as db:
        media = db.scalar(select(MediaAsset))
        assert media.media_type == "image/jpeg"
        assert media.byte_count == len(raw_photo)


def test_machine_events_remain_a_separate_read_stream(client):
    with SessionLocal() as db:
        db.add(MachineEvent(timestamp=datetime(2026, 8, 31, 18, 0, tzinfo=timezone.utc),
                            source="test_sensor", metric="steps", value=42, unit="count",
                            raw_payload={"raw": 42}))
        db.commit()
    response = client.get("/api/days/2026-08-31/machine-events")
    assert response.status_code == 200
    assert response.json()["events"][0]["metric"] == "steps"
    with SessionLocal() as db:
        assert db.scalar(select(HumanObservation)) is None
