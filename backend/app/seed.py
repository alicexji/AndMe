from .db import Base, engine


def main():
    Base.metadata.create_all(bind=engine)
    print("Database tables are ready.")


if __name__ == "__main__":
    main()
