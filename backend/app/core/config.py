from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-secret-change-me-before-deploying-0000"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "development" on your own machine; set ENVIRONMENT=production on the live server.
    environment: str = "development"

    database_url: str = "postgresql+psycopg://mm:mm@localhost:5432/misconceptmap"
    jwt_secret: str = DEV_SECRET
    jwt_expire_minutes: int = 60 * 24 * 7
    cors_origins: str = "http://localhost:5173"

    # LLM for the coach and for drafting misconception tags. Empty key = both use fallbacks.
    llm_api_key: str = ""
    llm_model: str = "gemini-2.5-flash"

    # Shown as the countdown on the dashboard. Set GATE_DATE in .env once the official
    # GATE 2027 schedule is announced.
    gate_date: str = "2027-02-06"

    @field_validator("database_url")
    @classmethod
    def _use_psycopg3(cls, url: str) -> str:
        """Hosts hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver named."""
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    @model_validator(mode="after")
    def _safe_in_production(self):
        if not self.is_production:
            return self
        problems = []
        if self.jwt_secret == DEV_SECRET or len(self.jwt_secret) < 32:
            problems.append("JWT_SECRET must be a private random string of 32+ characters")
        origins = self.cors_origin_list
        if not origins or any(o == "*" or "localhost" in o or "127.0.0.1" in o for o in origins):
            problems.append("CORS_ORIGINS must list only the live site's address (https://...)")
        if "localhost" in self.database_url:
            problems.append("DATABASE_URL must point at the production database")
        if problems:
            raise ValueError("Refusing to start in production: " + "; ".join(problems))
        return self

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
