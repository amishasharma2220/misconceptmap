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

app = FastAPI(title="MisconceptMap API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
