"""Unit tests for security functions: password hashing and JWT tokens."""
import jwt
import pytest

from apotheca_api.config import settings
from apotheca_api.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_and_verify_success(self):
        password = "mysecretpassword123"
        hashed = hash_password(password)
        assert hashed != password
        assert verify_password(password, hashed)

    def test_verify_wrong_password(self):
        hashed = hash_password("correctpassword")
        assert not verify_password("wrongpassword", hashed)

    def test_hash_is_unique(self):
        password = "samepassword123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2

    def test_verify_returns_false_on_garbage_hash(self):
        assert not verify_password("anything", "not-a-valid-hash")


class TestAccessTokens:
    def test_create_and_decode_access_token(self):
        user_id = "user-123"
        token = create_access_token(user_id, extra={"email": "test@test.com", "admin": False})
        payload = decode_token(token)
        assert payload["sub"] == user_id
        assert payload["type"] == "access"
        assert payload["email"] == "test@test.com"
        assert payload["admin"] is False
        assert "iat" in payload
        assert "exp" in payload

    def test_access_token_uses_configured_secret(self):
        token = create_access_token("user-1")
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        assert payload["sub"] == "user-1"


class TestRefreshTokens:
    def test_create_and_decode_refresh_token(self):
        user_id = "user-456"
        token = create_refresh_token(user_id)
        payload = decode_token(token)
        assert payload["sub"] == user_id
        assert payload["type"] == "refresh"
        assert "iat" in payload
        assert "exp" in payload

    def test_refresh_token_has_longer_expiry_than_access(self):
        access = decode_token(create_access_token("u1"))
        refresh = decode_token(create_refresh_token("u1"))
        access_lifetime = access["exp"] - access["iat"]
        refresh_lifetime = refresh["exp"] - refresh["iat"]
        assert refresh_lifetime > access_lifetime


class TestTokenTampering:
    def test_decode_invalid_token_raises(self):
        with pytest.raises(Exception):
            decode_token("not-a-valid-token")

    def test_decode_token_with_wrong_secret_fails(self):
        token = create_access_token("user-1")
        with pytest.raises(Exception):
            jwt.decode(token, "wrong-secret", algorithms=[settings.jwt_algorithm])
