"""Database engine/session. DATABASE_URL comes from .env only (Neon Postgres, sslmode=require)."""
from __future__ import annotations

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings


def sqlalchemy_url(url: str) -> str:
    """Neon gives postgresql://...; use the psycopg 3 driver."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not set. Add your Neon connection string to .env.")
    # No pre-ping (saves a round trip per request); connections are recycled before Neon's idle timeout.
    return create_engine(sqlalchemy_url(url), pool_pre_ping=False, pool_recycle=240, pool_size=10, max_overflow=10)


def get_sessionmaker() -> sessionmaker:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)
