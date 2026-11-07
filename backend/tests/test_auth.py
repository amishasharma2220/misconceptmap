from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hashing_roundtrip():
    h = hash_password("correct horse")
    assert h != "correct horse"
    assert verify_password("correct horse", h)
    assert not verify_password("wrong", h)


def test_token_roundtrip_and_tamper():
    token = create_access_token(42, "student")
    assert decode_access_token(token) == 42
    assert decode_access_token(token[:-2] + "xx") is None
    assert decode_access_token("garbage") is None


def test_register_login_me(client):
    r = client.post(
        "/auth/register",
        json={"email": "Amisha@Example.com", "password": "password123", "display_name": "Amisha"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "amisha@example.com"
    assert body["user"]["role"] == "student"

    r = client.post("/auth/login", json={"email": "AMISHA@example.com", "password": "password123"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    r = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Amisha"


def test_duplicate_email_rejected(client):
    payload = {"email": "a@example.com", "password": "password123"}
    assert client.post("/auth/register", json=payload).status_code == 201
    assert client.post("/auth/register", json=payload).status_code == 409


def test_short_password_rejected(client):
    r = client.post("/auth/register", json={"email": "a@example.com", "password": "short"})
    assert r.status_code == 422


def test_wrong_password(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "password123"})
    r = client.post("/auth/login", json={"email": "a@example.com", "password": "nope-nope"})
    assert r.status_code == 401


def test_me_requires_token(client):
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_students_cannot_use_admin_routes(client, student_headers):
    assert client.get("/admin/questions", headers=student_headers).status_code == 403


def test_admin_can_use_admin_routes(client, admin_headers):
    assert client.get("/admin/questions", headers=admin_headers).status_code == 200
