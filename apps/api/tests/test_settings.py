"""Integration tests for the settings router."""
from apotheca_api.models import Settings


class TestSettingsList:
    def test_list_settings_requires_auth(self, client):
        res = client.get("/api/settings")
        assert res.status_code == 401

    def test_list_settings_seeded(self, seeded_client, auth_headers):
        res = seeded_client.get("/api/settings", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        keys = [s["key"] for s in body]
        assert "expiry_warning_days" in keys
        assert "depletion_threshold_days" in keys
        assert "ntfy_topic" in keys


class TestSettingsUpdate:
    def test_update_existing_setting(self, seeded_client, auth_headers):
        res = seeded_client.put("/api/settings/expiry_warning_days", json={"value": "60"}, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["value"] == "60"

    def test_update_setting_not_found(self, seeded_client, auth_headers):
        res = seeded_client.put("/api/settings/nonexistent_key", json={"value": "x"}, headers=auth_headers)
        assert res.status_code == 404

    def test_update_setting_persists(self, seeded_client, auth_headers, db_session):
        seeded_client.put("/api/settings/expiry_warning_days", json={"value": "90"}, headers=auth_headers)
        row = db_session.query(Settings).filter(Settings.key == "expiry_warning_days").first()
        assert row.value == "90"

    def test_update_setting_requires_auth(self, client):
        res = client.put("/api/settings/expiry_warning_days", json={"value": "60"})
        assert res.status_code == 401
