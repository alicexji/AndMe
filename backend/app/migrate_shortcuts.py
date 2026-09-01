"""Preserve Twilio-era rows while making their legacy links optional."""

from sqlalchemy import inspect, text

from .db import engine


def main():
    inspector = inspect(engine)
    if engine.dialect.name != "postgresql":
        print("Compatibility migration skipped: it is only required for an existing PostgreSQL database.")
        return

    observation_columns = {column["name"] for column in inspector.get_columns("human_observations")}
    with engine.begin() as connection:
        if "inbound_message_id" in observation_columns:
            connection.execute(text(
                "ALTER TABLE human_observations ALTER COLUMN inbound_message_id DROP NOT NULL"))
    print("Shortcut compatibility migration complete; historical rows were preserved.")


if __name__ == "__main__":
    main()
