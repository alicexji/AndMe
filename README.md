# Machine / Me — collection MVP

Machine / Me compares two distinct archives:

- **Human observations:** moments a person deliberately chooses to preserve.
- **Machine events:** future continuous/passive measurements from devices.

This MVP implements only the human logging path:

```text
Apple Shortcut “Notice” → FastAPI → PostgreSQL + local media → React verification page
```

There are no prompts, schedules, mood ratings, tags, AI systems, or device integrations. Submitted text and photo bytes are preserved without interpretation.

## Structure

```text
backend/   FastAPI ingestion API, PostgreSQL models, media adapter, tests
frontend/  React + TypeScript verification timeline
docs/      architecture and beginner Shortcut instructions
```

## Start

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item ..\.env.example .env
python -m app.seed
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. See [docs/setup.md](docs/setup.md) for the complete `Notice` Shortcut and end-to-end test.

## API

Both write routes require `Authorization: Bearer <INGESTION_API_KEY>`.

- `POST /api/observations` — JSON text observation.
- `POST /api/observations/photo` — multipart photo with optional text.
- `GET /api/days/{YYYY-MM-DD}/observations` — verification timeline.
- `GET /health` — server and database health.

Run backend tests from `backend/` with `python -m pytest -q`.

