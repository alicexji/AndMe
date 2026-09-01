# Create and test the `Notice` iPhone Shortcut

## 1. Prepare the backend

Set these values in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/machine_me
APP_TIMEZONE=America/New_York
PUBLIC_BASE_URL=http://YOUR-COMPUTER-IP:8000
MEDIA_ROOT=./media
INGESTION_API_KEY=YOUR-LONG-RANDOM-SECRET
CORS_ORIGINS=http://localhost:5173
```

Generate a secret if needed:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

If this database came from the earlier prototype, run the compatibility migration once. It preserves all historical rows:

```powershell
python -m app.migrate_shortcuts
```

Start FastAPI:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Find the computer's Wi-Fi IPv4 address with `ipconfig`. On the iPhone, while connected to the same Wi-Fi, open `http://YOUR-COMPUTER-IP:8000/health` in Safari. Continue only after it shows `{"status":"ok"}`. Do not use `localhost` or `0.0.0.0` on the phone.

## 2. Keep the existing text branch

The working text branch should remain:

1. **Ask for Input** with prompt `What did you notice?` and type **Text**. Type normally or tap the microphone on the iPhone keyboard to dictate.
2. **URL** containing `http://YOUR-COMPUTER-IP:8000/api/observations`.
3. **Get Contents of URL** configured as:
   - Method: `POST`
   - Header: `Authorization` → `Bearer YOUR-LONG-RANDOM-SECRET`
   - Request Body: `JSON`
   - `type` → Text → `INTENTIONAL`
   - `text` → the colored **Provided Input** variable from Ask for Input
4. **Show Alert** with `Observation saved.`

This already supports typed and dictated text. The backend timestamps it when received, so adding a Date action is optional.

## 3. Turn `Notice` into a text-or-photo Shortcut

Open `Notice` for editing. Add **Choose from Menu** as the first action and create two choices: `Text` and `Photo`. Drag the existing four text actions into the `Text` section.

Inside the `Photo` section:

1. Add another **Choose from Menu** with `Take Photo` and `Choose Photo` choices.
2. Under `Take Photo`, add the **Take Photo** action.
3. Under `Choose Photo`, add the **Select Photos** action and leave selection limited to one photo.
4. After the inner menu ends, add **Ask for Input** with prompt `Why this? Optional—tap Done to skip.` and type **Text**.
5. Add a **URL** action containing `http://YOUR-COMPUTER-IP:8000/api/observations/photo`.
6. Add **Get Contents of URL**:
   - Method: `POST`
   - Header: `Authorization` → `Bearer YOUR-LONG-RANDOM-SECRET`
   - Request Body: `Form`
   - `photo` → select the colored photo result from the preceding photo menu
   - `text` → select the colored result from `Why this?`
7. Add **Show Alert** with `Photo saved.`

The final shape is:

```text
Choose from Menu
├─ Text
│  ├─ Ask for Input
│  ├─ URL (/api/observations)
│  ├─ Get Contents of URL (JSON)
│  └─ Show Alert
└─ Photo
   ├─ Choose from Menu
   │  ├─ Take Photo
   │  └─ Select Photos
   ├─ Ask for Input (“Why this?”)
   ├─ URL (/api/observations/photo)
   ├─ Get Contents of URL (Form)
   └─ Show Alert
```

Shortcuts may label the outputs `Photo`, `Selected Photos`, `Menu Result`, or as colored magic variables. Tap a Form value field and select the colored image variable produced by the inner menu; do not type its name manually.

## 4. Test text and photo

Run `Notice`, choose `Text`, and submit `Pipeline text test`. Then run it again, choose `Photo`, take or select an image, and optionally enter a short explanation.

Verify today's observations:

```powershell
Invoke-RestMethod http://localhost:8000/api/days/2026-08-31/observations
```

Verify PostgreSQL:

```sql
SELECT id, observation_type, source, raw_text, received_at
FROM human_observations
ORDER BY created_at DESC
LIMIT 10;

SELECT observation_id, media_type, byte_count, sha256, storage_key
FROM media_assets
ORDER BY received_at DESC
LIMIT 10;
```

Text must appear unchanged with `observation_type = 'INTENTIONAL'` and `source = 'apple_shortcuts'`. A photo creates both a human-observation row and a media row, plus the original bytes beneath `MEDIA_ROOT`.

