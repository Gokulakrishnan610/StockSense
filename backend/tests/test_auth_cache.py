def assert_private(response):
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Pragma"] == "no-cache"


def test_tokens_profiles_and_errors_are_not_cached(client, account, staff):
    assert_private(
        client.post(
            "/auth/login", json={"login_id": account["login_id"], "password": account["password"]}
        )
    )
    assert_private(client.get("/auth/me", headers=staff))
    denied = client.get("/auth/me")
    assert denied.status_code == 401
    assert_private(denied)
    invalid = client.post("/auth/login", json={})
    assert invalid.status_code == 422
    assert_private(invalid)


def test_reset_token_is_not_cached(client, account, mailbox):
    email = {"email": account["email"]}
    assert_private(client.post("/auth/forgot-password", json=email))
    response = client.post("/auth/verify-otp", json={**email, "otp": mailbox[0][1]})
    assert response.status_code == 200
    assert "reset_token" in response.json()
    assert_private(response)
