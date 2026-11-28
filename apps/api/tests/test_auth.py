"""Integration tests for the auth router: register, login, refresh, password reset."""
from apotheca_api.config import settings
from apotheca_api.models import AuditLog, User
from apotheca_api.security import decode_token


class TestRegister:
    def test_register_success(self, client, db_session):
        res = client.post("/api/auth/register", json={
            "email": "new@example.com",
            "name": "New User",
            "password": "password123",
        })
        assert res.status_code == 201
        body = res.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

        payload = decode_token(body["access_token"])
        assert payload["email"] == "new@example.com"
        assert payload["admin"] is False

    def test_register_duplicate_email_conflict(self, client, db_session):
        client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "name": "First",
            "password": "password123",
        })
        res = client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "name": "Second",
            "password": "password456",
        })
        assert res.status_code == 409

    def test_register_short_password_rejected(self, client):
        res = client.post("/api/auth/register", json={
            "email": "short@example.com",
            "name": "Short",
            "password": "short",
        })
        assert res.status_code == 422

    def test_register_invalid_email_rejected(self, client):
        res = client.post("/api/auth/register", json={
            "email": "not-an-email",
            "name": "Bad",
            "password": "password123",
        })
        assert res.status_code == 422

    def test_register_creates_audit_log(self, client, db_session):
        client.post("/api/auth/register", json={
            "email": "audited@example.com",
            "name": "Audited",
            "password": "password123",
        })
        logs = db_session.query(AuditLog).filter(AuditLog.action == "register").all()
        assert len(logs) == 1

    def test_register_email_is_lowercased(self, client, db_session):
        client.post("/api/auth/register", json={
            "email": "UPPER@EXAMPLE.COM",
            "name": "Upper",
            "password": "password123",
        })
        user = db_session.query(User).filter(User.email == "upper@example.com").first()
        assert user is not None


class TestLogin:
    def test_login_success(self, seeded_client):
        res = seeded_client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "testpassword123",
        })
        assert res.status_code == 200
        body = res.json()
        assert "access_token" in body
        assert "refresh_token" in body

    def test_login_wrong_password(self, seeded_client):
        res = seeded_client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword",
        })
        assert res.status_code == 401

    def test_login_unknown_user(self, client):
        res = client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "password123",
        })
        assert res.status_code == 401

    def test_login_email_case_insensitive(self, seeded_client):
        res = seeded_client.post("/api/auth/login", json={
            "email": "TEST@EXAMPLE.COM",
            "password": "testpassword123",
        })
        assert res.status_code == 200


class TestRefresh:
    def test_refresh_success(self, seeded_client):
        login_res = seeded_client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "testpassword123",
        })
        refresh_token = login_res.json()["refresh_token"]

        res = seeded_client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        assert res.status_code == 200
        body = res.json()
        assert "access_token" in body
        assert "refresh_token" in body
        # New access token should be valid and contain the user's info
        new_payload = decode_token(body["access_token"])
        assert new_payload["sub"] == decode_token(refresh_token)["sub"]

    def test_refresh_with_invalid_token(self, client):
        res = client.post("/api/auth/refresh", json={"refresh_token": "invalid-token"})
        assert res.status_code == 401

    def test_refresh_with_access_token_fails(self, seeded_client):
        login_res = seeded_client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "testpassword123",
        })
        access_token = login_res.json()["access_token"]

        res = seeded_client.post("/api/auth/refresh", json={"refresh_token": access_token})
        assert res.status_code == 401


class TestPasswordReset:
    def test_request_reset_for_existing_user_hides_dev_token_by_default(self, seeded_client):
        res = seeded_client.post("/api/auth/password-reset", json={"email": "test@example.com"})
        assert res.status_code == 202
        body = res.json()
        assert body["message"] == "If the email is registered, a reset link has been sent"
        assert "dev_token" not in body

    def test_request_reset_returns_dev_token_in_debug_mode(self, seeded_client, monkeypatch):
        monkeypatch.setattr(settings, "debug", True)
        res = seeded_client.post("/api/auth/password-reset", json={"email": "test@example.com"})
        assert res.status_code == 202
        body = res.json()
        assert "dev_token" in body

    def test_request_reset_for_unknown_user_returns_same_message(self, client):
        res = client.post("/api/auth/password-reset", json={"email": "nobody@example.com"})
        assert res.status_code == 202
        body = res.json()
        assert body["message"] == "If the email is registered, a reset link has been sent"
        assert "dev_token" not in body

    def test_confirm_password_reset_success(self, seeded_client, db_session, monkeypatch):
        monkeypatch.setattr(settings, "debug", True)
        # Request reset
        reset_res = seeded_client.post("/api/auth/password-reset", json={"email": "test@example.com"})
        dev_token = reset_res.json()["dev_token"]

        # Confirm with new password
        confirm_res = seeded_client.post("/api/auth/password-reset/confirm", json={
            "token": dev_token,
            "new_password": "newpassword123",
        })
        assert confirm_res.status_code == 200

        # Login with new password
        login_res = seeded_client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "newpassword123",
        })
        assert login_res.status_code == 200

    def test_confirm_reset_with_invalid_token(self, seeded_client):
        res = seeded_client.post("/api/auth/password-reset/confirm", json={
            "token": "invalid-token",
            "new_password": "newpassword123",
        })
        assert res.status_code == 400

    def test_confirm_reset_with_short_password_rejected(self, seeded_client, monkeypatch):
        monkeypatch.setattr(settings, "debug", True)
        reset_res = seeded_client.post("/api/auth/password-reset", json={"email": "test@example.com"})
        dev_token = reset_res.json()["dev_token"]

        res = seeded_client.post("/api/auth/password-reset/confirm", json={
            "token": dev_token,
            "new_password": "short",
        })
        assert res.status_code == 422
