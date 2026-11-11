import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.auth import ratelimit
from app.core.config import Settings
from app.models import (
    Attempt,
    CoachConversation,
    CoachMessage,
    Mastery,
    PracticeSession,
    Question,
    ReviewItem,
    SessionItem,
    User,
)

PASSWORD = "password123"


def signup(client, email="new@example.com"):
    r = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ------------------------------------------------------------------ profile


def test_update_name_and_consent_independently(client):
    h = signup(client)
    r = client.patch("/me", json={"consent_research": True}, headers=h)
    assert r.status_code == 200 and r.json()["consent_research"] is True
    r = client.patch("/me", json={"display_name": "  Amisha  "}, headers=h)
    assert r.json()["display_name"] == "Amisha" and r.json()["consent_research"] is True
    r = client.patch("/me", json={"display_name": ""}, headers=h)
    assert r.json()["display_name"] is None
    assert client.patch("/me", json={"display_name": "x" * 81}, headers=h).status_code == 422
    assert client.patch("/me", json={"consent_research": False}).status_code == 401


def test_role_and_email_cannot_be_changed_through_profile(client):
    h = signup(client)
    r = client.patch("/me", json={"role": "admin", "email": "x@example.com"}, headers=h)
    assert r.json()["role"] == "student" and r.json()["email"] == "new@example.com"


# ------------------------------------------------------------------ delete my data


def test_delete_removes_everything_for_that_user_only(client, db, bank, student_headers):
    h = signup(client)
    for headers in (h, student_headers):
        qid = bank["dsa-stk-001"]
        q = db.get(Question, qid)
        wrong = next(o.label for o in q.options if not o.is_correct)
        s = client.post(
            "/sessions", json={"mode": "questions", "questions": [qid]}, headers=headers
        ).json()
        client.post(
            f"/sessions/{s['id']}/answer",
            json={"question_id": qid, "chosen": [wrong]},
            headers=headers,
        )
        client.post("/coach/chat", json={"message": "plan my week"}, headers=headers)

    assert client.post("/me/delete", json={"password": "nope"}, headers=h).status_code == 403
    assert client.post("/me/delete", json={"password": PASSWORD}, headers=h).status_code == 204

    # the deleted account is gone, its token no longer works, and it cannot sign in
    assert client.get("/me", headers=h).status_code == 401
    r = client.post("/auth/login", json={"email": "new@example.com", "password": PASSWORD})
    assert r.status_code == 401

    # exactly one user's worth of data is left: the other student's
    def count(model):
        return db.scalar(select(func.count()).select_from(model))

    assert count(User) == 1
    for model in (Attempt, Mastery, ReviewItem, PracticeSession, SessionItem, CoachConversation):
        assert count(model) == 1, model.__name__
    assert count(CoachMessage) == 2
    assert client.get("/me/snapshot", headers=student_headers).json()["totals"]["answered"] == 1
    assert count(Question) == 13  # content is untouched


def test_the_only_admin_cannot_delete_themselves(client, db, admin_headers):
    r = client.post("/me/delete", json={"password": "password123"}, headers=admin_headers)
    assert r.status_code == 409 and "only admin" in r.json()["detail"]


# ------------------------------------------------------------------ sign-in limits


def test_repeated_wrong_passwords_are_blocked_then_blocked_even_if_correct(client):
    signup(client)
    bad = {"email": "new@example.com", "password": "wrong-password"}
    for _ in range(5):
        assert client.post("/auth/login", json=bad).status_code == 401
    r = client.post("/auth/login", json=bad)
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0
    good = {"email": "NEW@example.com", "password": PASSWORD}
    assert client.post("/auth/login", json=good).status_code == 429
    # a different account from the same address is not affected
    signup(client, "other@example.com")
    r = client.post("/auth/login", json={"email": "other@example.com", "password": PASSWORD})
    assert r.status_code == 200


def test_a_successful_sign_in_clears_the_count(client):
    signup(client)
    bad = {"email": "new@example.com", "password": "wrong-password"}
    good = {"email": "new@example.com", "password": PASSWORD}
    for _ in range(4):
        client.post("/auth/login", json=bad)
    assert client.post("/auth/login", json=good).status_code == 200
    for _ in range(4):
        assert client.post("/auth/login", json=bad).status_code == 401


def test_account_limit_holds_across_addresses(client):
    signup(client)
    bad = {"email": "new@example.com", "password": "wrong-password"}
    for i in range(20):
        r = client.post("/auth/login", json=bad, headers={"X-Forwarded-For": f"10.0.0.{i}"})
        assert r.status_code == 401
    r = client.post("/auth/login", json=bad, headers={"X-Forwarded-For": "10.0.1.1"})
    assert r.status_code == 429


def test_signups_per_address_are_limited(client, monkeypatch):
    monkeypatch.setattr(ratelimit.signups, "limit", 2)
    signup(client, "a@example.com")
    signup(client, "b@example.com")
    r = client.post("/auth/register", json={"email": "c@example.com", "password": PASSWORD})
    assert r.status_code == 429


def test_old_attempts_expire(monkeypatch):
    lim = ratelimit.Limiter(2, 60, "slow down")
    clock = [1000.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: clock[0])
    lim.hit("k")
    lim.hit("k")
    with pytest.raises(Exception, match="slow down"):
        lim.check("k")
    clock[0] += 61
    lim.check("k")


# ------------------------------------------------------------------ production settings

GOOD = {
    "environment": "production",
    "jwt_secret": "x" * 40,
    "cors_origins": "https://misconceptmap.example",
    "database_url": "postgres://u:p@db.host.example/mm",
}


def make(**over):
    return Settings(_env_file=None, **{**GOOD, **over})


def test_production_settings_accept_a_safe_configuration():
    s = make()
    assert s.is_production
    assert s.database_url == "postgresql+psycopg://u:p@db.host.example/mm"


@pytest.mark.parametrize(
    "over, problem",
    [
        ({"jwt_secret": "dev-only-secret-change-me-before-deploying-0000"}, "JWT_SECRET"),
        ({"jwt_secret": "short"}, "JWT_SECRET"),
        ({"cors_origins": "http://localhost:5173"}, "CORS_ORIGINS"),
        ({"cors_origins": "*"}, "CORS_ORIGINS"),
        ({"database_url": "postgresql+psycopg://mm:mm@localhost:5432/mm"}, "DATABASE_URL"),
    ],
)
def test_production_refuses_unsafe_settings(over, problem):
    with pytest.raises(ValidationError, match=problem):
        make(**over)


def test_development_keeps_working_with_defaults():
    s = Settings(_env_file=None, environment="development")
    assert not s.is_production
