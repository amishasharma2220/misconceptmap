#!/usr/bin/env sh
# Start command for the live server: bring the database up to date, then serve.
# If a migration fails, the server does not start, so a bad deploy never runs on a
# half-updated database.
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
