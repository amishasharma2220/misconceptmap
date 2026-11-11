from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    get_settings().database_url,
    # Hosted databases close idle connections: check before use and refresh every 5 minutes.
    pool_pre_ping=True,
    pool_recycle=300,
    # Hosted connection poolers (Neon, Supabase) do not keep server-side prepared statements.
    connect_args={"prepare_threshold": None},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Use as a type annotation in routes: `def route(db: DbSession): ...`
DbSession = Annotated[Session, Depends(get_db)]
