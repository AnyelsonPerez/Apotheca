"""Integration tests for inventory, lots, and CIMA-medication creation.

CIMA HTTP calls are mocked via patch_cima fixture — no real network calls.
"""
from apotheca_api.models import ActiveIngredient, Lot, Medication, Presentation


class TestMedicationCRUD:
    def test_add_medication_from_cima(self, seeded_client, db_session, patch_cima, auth_headers):
        res = seeded_client.post(
            "/api/inventory/medications",
            json={"nregistro": "12345"},
            headers=auth_headers,
        )
        assert res.status_code == 201
        body = res.json()
        assert body["national_code"] == "12345"
        assert body["name"] == "Ibuprofeno Test 400mg"
        assert body["laboratory"] == "TestLab SA"
        assert body["active_ingredient_name"] == "Ibuprofeno"
        assert body["presentation_name"] == "Comprimido"

    def test_add_duplicate_medication_returns_existing(self, seeded_client, db_session, patch_cima, auth_headers):
        first = seeded_client.post("/api/inventory/medications", json={"nregistro": "12345"}, headers=auth_headers)
        second = seeded_client.post("/api/inventory/medications", json={"nregistro": "12345"}, headers=auth_headers)
        assert first.status_code == 201
        assert second.status_code == 201
        assert first.json()["id"] == second.json()["id"]

    def test_list_medications(self, seeded_client, db_session, patch_cima, auth_headers):
        seeded_client.post("/api/inventory/medications", json={"nregistro": "12345"}, headers=auth_headers)
        res = seeded_client.get("/api/inventory/medications", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert len(body) >= 1
        assert body[0]["name"] == "Ibuprofeno Test 400mg"

    def test_get_medication_by_id(self, seeded_client, db_session, patch_cima, auth_headers):
        create_res = seeded_client.post("/api/inventory/medications", json={"nregistro": "12345"}, headers=auth_headers)
        med_id = create_res.json()["id"]
        res = seeded_client.get(f"/api/inventory/medications/{med_id}", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["id"] == med_id

    def test_get_medication_not_found(self, seeded_client, auth_headers):
        res = seeded_client.get("/api/inventory/medications/nonexistent", headers=auth_headers)
        assert res.status_code == 404

    def test_delete_medication(self, seeded_client, db_session, patch_cima, auth_headers):
        create_res = seeded_client.post("/api/inventory/medications", json={"nregistro": "12345"}, headers=auth_headers)
        med_id = create_res.json()["id"]
        del_res = seeded_client.delete(f"/api/inventory/medications/{med_id}", headers=auth_headers)
        assert del_res.status_code == 204
        get_res = seeded_client.get(f"/api/inventory/medications/{med_id}", headers=auth_headers)
        assert get_res.status_code == 404


def _create_medication(seeded_client, patch_cima, auth_headers):
    """Helper: create a medication via the API and return its ID."""
    res = seeded_client.post("/api/inventory/medications", json={"nregistro": "12345"}, headers=auth_headers)
    assert res.status_code == 201, f"Failed to create medication: {res.json()}"
    return res.json()["id"]


class TestLots:
    def test_create_lot(self, seeded_client, db_session, patch_cima, auth_headers):
        med_id = _create_medication(seeded_client, patch_cima, auth_headers)
        res = seeded_client.post("/api/inventory/lots", json={
            "medication_id": med_id,
            "quantity": 10,
            "expiry_date": "2027-12-31T00:00:00",
            "daily_dose": 2.0,
        }, headers=auth_headers)
        assert res.status_code == 201
        body = res.json()
        assert body["medication_id"] == med_id
        assert body["quantity"] == 10
        assert body["daily_dose"] == 2.0

    def test_create_lot_unknown_medication(self, seeded_client, auth_headers):
        res = seeded_client.post("/api/inventory/lots", json={
            "medication_id": "nonexistent",
            "quantity": 5,
        }, headers=auth_headers)
        assert res.status_code == 404

    def test_list_lots(self, seeded_client, db_session, patch_cima, auth_headers):
        med_id = _create_medication(seeded_client, patch_cima, auth_headers)
        seeded_client.post("/api/inventory/lots", json={
            "medication_id": med_id, "quantity": 10,
        }, headers=auth_headers)
        seeded_client.post("/api/inventory/lots", json={
            "medication_id": med_id, "quantity": 20,
        }, headers=auth_headers)
        res = seeded_client.get("/api/inventory/lots", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.json()) == 2

    def test_update_lot(self, seeded_client, db_session, patch_cima, auth_headers):
        med_id = _create_medication(seeded_client, patch_cima, auth_headers)
        create_res = seeded_client.post("/api/inventory/lots", json={
            "medication_id": med_id, "quantity": 10,
        }, headers=auth_headers)
        lot_id = create_res.json()["id"]
        res = seeded_client.put(f"/api/inventory/lots/{lot_id}", json={"quantity": 50}, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["quantity"] == 50

    def test_update_lot_not_found(self, seeded_client, auth_headers):
        res = seeded_client.put("/api/inventory/lots/nonexistent", json={"quantity": 1}, headers=auth_headers)
        assert res.status_code == 404

    def test_delete_lot(self, seeded_client, db_session, patch_cima, auth_headers):
        med_id = _create_medication(seeded_client, patch_cima, auth_headers)
        create_res = seeded_client.post("/api/inventory/lots", json={
            "medication_id": med_id, "quantity": 10,
        }, headers=auth_headers)
        lot_id = create_res.json()["id"]
        del_res = seeded_client.delete(f"/api/inventory/lots/{lot_id}", headers=auth_headers)
        assert del_res.status_code == 204

    def test_delete_lot_not_found(self, seeded_client, auth_headers):
        res = seeded_client.delete("/api/inventory/lots/nonexistent", headers=auth_headers)
        assert res.status_code == 404


class TestInventory:
    def test_get_inventory_empty(self, seeded_client, auth_headers):
        res = seeded_client.get("/api/inventory", headers=auth_headers)
        assert res.status_code == 200
        assert res.json() == []

    def test_get_inventory_with_lots(self, seeded_client, db_session, patch_cima, auth_headers):
        med_id = _create_medication(seeded_client, patch_cima, auth_headers)
        seeded_client.post("/api/inventory/lots", json={
            "medication_id": med_id, "quantity": 10,
        }, headers=auth_headers)
        seeded_client.post("/api/inventory/lots", json={
            "medication_id": med_id, "quantity": 20,
        }, headers=auth_headers)
        res = seeded_client.get("/api/inventory", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["total_quantity"] == 30
        assert len(body[0]["lots"]) == 2


class TestUnauthenticatedAccess:
    def test_inventory_requires_auth(self, client):
        res = client.get("/api/inventory")
        assert res.status_code == 401

    def test_lots_requires_auth(self, client):
        res = client.get("/api/inventory/lots")
        assert res.status_code == 401

    def test_alerts_requires_auth(self, client):
        res = client.get("/api/alerts")
        assert res.status_code == 401
