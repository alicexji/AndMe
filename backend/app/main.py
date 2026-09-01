from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from . import models
from .api import router as api_router
from .config import get_settings
from .db import Base, SessionLocal, engine

settings = get_settings()
settings.media_root.mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Machine / Me collection API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["*"])
app.include_router(api_router)
app.mount("/media", StaticFiles(directory=settings.media_root), name="media")


@app.get("/health")
def health():
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}
