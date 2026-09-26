import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PasswordReset, User
from app.security import password_hasher


def test_signup_login_profile_logout(client, account, engine):
    with Session(engine) as db:
        user = db.scalar(select(User))
        assert user.password_hash != account["password"]
        assert password_hasher.verify(account["password"], user.password_hash)
    login = client.post(
        "/auth/login", json={"login_id": account["email"], "password": account["password"]}
    )
    assert login.status_code == 200
    assert login.json()["redirect_to"] == "/dashboard"
    headers = {"Authorization": "Bearer " + login.json()["access_token"]}
    profile = client.get("/auth/me", headers=headers)
    assert profile.json()["role"] == "WAREHOUSE_STAFF"
    assert "password_hash" not in profile.json()
    assert client.post("/auth/logout", headers=headers).status_code == 204
    assert client.get("/auth/me", headers=headers).status_code == 401


def test_signup_duplicate_and_no_self_promotion(client, account):
    assert client.post("/auth/signup", json=account).status_code == 409
    assert (
        client.post("/auth/signup", json={**account, "role": "INVENTORY_MANAGER"}).status_code
        == 422
    )
    changed = {**account, "login_id": "anotherstaff", "email": account["email"].upper()}
    assert client.post("/auth/signup", json=changed).status_code == 409


def test_invalid_credentials_and_lockout(client, account):
    for _ in range(5):
        response = client.post(
            "/auth/login", json={"login_id": account["login_id"], "password": "wrong password"}
        )
        assert response.status_code == 401
    assert (
        client.post(
            "/auth/login", json={"login_id": account["login_id"], "password": account["password"]}
        ).status_code
        == 429
    )
    assert (
        client.post("/auth/login", json={"login_id": "missing", "password": "wrong"}).status_code
        == 401
    )


def test_authorization(client, staff):
    for path in ["/products", "/categories", "/locations", "/warehouses", "/reorder-rules"]:
        assert client.get(path).status_code == 401
        assert client.get(path, headers=staff).status_code == 200
        assert client.get(path, headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert client.post("/categories", json={"name": "Tools"}, headers=staff).status_code == 403


def test_password_reset_lifecycle(client, account, staff, mailbox):
    email = {"email": account["email"]}
    unknown = client.post("/auth/forgot-password", json={"email": "unknown@example.com"})
    response = client.post("/auth/forgot-password", json=email)
    assert response.status_code == unknown.status_code == 202
    assert response.json() == unknown.json()
    assert len(mailbox) == 1
    client.post("/auth/forgot-password", json=email)
    assert len(mailbox) == 1  # Resend cooldown.
    otp = mailbox[0][1]
    verified = client.post("/auth/verify-otp", json={**email, "otp": otp})
    assert verified.status_code == 200
    token = verified.json()["reset_token"]
    assert client.post("/auth/verify-otp", json={**email, "otp": otp}).status_code == 400
    assert (
        client.post(
            "/auth/reset-password",
            json={"reset_token": token, "new_password": "A new safe password!"},
        ).status_code
        == 204
    )
    assert client.get("/auth/me", headers=staff).status_code == 401
    assert (
        client.post(
            "/auth/reset-password",
            json={"reset_token": token, "new_password": "A new safe password!"},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/auth/login", json={"login_id": account["login_id"], "password": account["password"]}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/auth/login",
            json={"login_id": account["login_id"], "password": "A new safe password!"},
        ).status_code
        == 200
    )


def test_otp_attempt_limit_and_expiry(client, account, mailbox, engine):
    email = {"email": account["email"]}
    client.post("/auth/forgot-password", json=email)
    correct = mailbox[0][1]
    wrong = "000000" if correct != "000000" else "111111"
    for _ in range(5):
        assert client.post("/auth/verify-otp", json={**email, "otp": wrong}).status_code == 400
    assert client.post("/auth/verify-otp", json={**email, "otp": correct}).status_code == 400
    with Session(engine) as db, db.begin():
        challenge = db.scalar(select(PasswordReset))
        assert challenge.attempts == 5
        assert challenge.otp_hash != correct
        challenge.attempts = 0
        challenge.expires_at = int(time.time()) - 1
    assert client.post("/auth/verify-otp", json={**email, "otp": correct}).status_code == 400


def test_validation_does_not_echo_password(client):
    response = client.post("/auth/signup", json={"password": "secret"})
    assert response.status_code == 422
    assert "secret" not in response.text


def test_reset_token_expiry(client, account, mailbox, engine):
    email = {"email": account["email"]}
    client.post("/auth/forgot-password", json=email)
    token = client.post("/auth/verify-otp", json={**email, "otp": mailbox[0][1]}).json()[
        "reset_token"
    ]
    with Session(engine) as db, db.begin():
        challenge = db.scalar(select(PasswordReset))
        assert challenge.reset_token_hash != token
        challenge.expires_at = int(time.time()) - 1
    assert (
        client.post(
            "/auth/reset-password",
            json={"reset_token": token, "new_password": "New safe password!"},
        ).status_code
        == 400
    )


def test_concurrent_otp_verification_is_single_use(client, account, mailbox):
    email = {"email": account["email"]}
    client.post("/auth/forgot-password", json=email)
    payload = {**email, "otp": mailbox[0][1]}
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(
            pool.map(lambda _: client.post("/auth/verify-otp", json=payload).status_code, range(2))
        )
    assert sorted(statuses) == [200, 400]


@pytest.mark.parametrize("extra", [{"role": "INVENTORY_MANAGER"}, {"token_version": 0}])
def test_profile_fields_cannot_be_injected(client, account, extra):
    assert client.post("/auth/signup", json={**account, **extra}).status_code == 422
