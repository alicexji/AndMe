import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_shortcuts_machine_me.db"
os.environ["MEDIA_ROOT"] = "./test_media"
os.environ["INGESTION_API_KEY"] = "test-secret-key"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.db import Base, engine
from app.main import app
from app.models import HumanObservation, MachineEvent, MediaAsset


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(delete(MediaAsset))
        connection.execute(delete(HumanObservation))
        connection.execute(delete(MachineEvent))
    yield


@pytest.fixture
def client():
    return TestClient(app)
