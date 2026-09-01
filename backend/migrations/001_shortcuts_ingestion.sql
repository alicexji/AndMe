-- Compatibility migration for databases created by the former Twilio prototype.
-- It preserves all historical rows while allowing new Shortcut observations.
-- Fresh databases created from the current models do not need this migration.

ALTER TABLE human_observations
    ALTER COLUMN inbound_message_id DROP NOT NULL;
