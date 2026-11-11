from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.auth.router import router as auth_router
from app.coach.router import router as coach_router
from app.content.router import router as content_router
from app.core.config import get_settings
from app.core.db import DbSession
from app.practice.router import me_router
from app.practice.router import router as practice_router

settings = get_settings()

app = FastAPI(
    title="MisconceptMap API",
    version="0.5.0",
    # The interactive API docs are a development tool; keep them off the live server.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    # Sign-in uses a bearer token in a header, not cookies, so credentials are not needed.
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
def health(db: DbSession) -> dict:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "db": "ok"}


app.include_router(auth_router)
app.include_router(content_router)
app.include_router(practice_router)
app.include_router(me_router)
app.include_router(coach_router)
