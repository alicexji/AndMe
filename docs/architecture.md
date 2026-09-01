# Architecture

## Collection boundary

The only human collection concept is a deliberate notice. Typed text, dictated text, and a photo with optional text all create an `INTENTIONAL` `human_observations` row. No categorization, prompt, tag, score, or interpretation is required.

The API stores text without trimming or normalization. A timezone-aware phone timestamp is normalized to UTC for querying while its submitted ISO representation is retained in the observation context. When the phone omits the timestamp, the server records its current UTC time. Server creation time remains separate.

Photo bytes are written through `LocalMediaStore` and represented by a `media_assets` row containing MIME type, original filename context, byte count, storage key, receipt time, and SHA-256 checksum. The adapter can later be replaced by object storage without changing observations.

## Data separation

- `human_observations`: raw deliberate human notices.
- `media_assets`: raw media attached to a human notice.
- `machine_events`: separate future append-only device measurements.

Earlier prototype rows using sampled or retrospective observation enum values remain readable, but current API input only permits `INTENTIONAL`. Retired prompt and inbound-message tables may remain in an existing PostgreSQL database as historical data; the application no longer maps or writes them.

Future AI interpretations, embeddings, relationships, or artistic features must be stored as separate derived records. They must never replace raw text, media, timestamps, or machine events.

## Security

Write routes use one Bearer API key from `INGESTION_API_KEY`. There are deliberately no users, sessions, or OAuth flows. HTTPS is required before exposing ingestion beyond a trusted local network.

