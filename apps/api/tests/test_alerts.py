"""Integration tests for the alerts router: expiry and depletion calculation."""
from datetime import date, datetime, timedelta, timezone

from apotheca_api.cima import get_cima_client
from apotheca_api.app import app
from apotheca_api.models import Lot, Medication, User


def _create_med_and_lot(db_session, user_id, quantity=10, expiry_date=None, daily_dose=None,
                        treatment_days=None, dose_start_date=None):
    """Create a medication + lot directly in the DB."""
    med = Medication(
        national_code="TEST001",
        name="Test Medication",
        barcode=None,
        laboratory="TestLab",
        dosage="100mg",
        prescription=False,
        active_ingredient_id=None,
        presentation_id=None,
    )
    # Need active ingredient and presentation due to FK
    from apotheca_api.models import ActiveIngredient, Presentation
    ai = ActiveIngredient(name="TestAI")
    pres = Presentation(name="TestPres")
    db_session.add_all([ai, pres])
    db_session.flush()
    med.active_ingredient_id = ai.id
    med.presentation_id = pres.id
    db_session.add(med)
    db_session.flush()

    lot = Lot(
        medication_id=med.id,
        user_id=user_id,
        quantity=quantity,
        expiry_date=expiry_date,
        daily_dose=daily_dose,
        treatment_days=treatment_days,
        dose_start_date=dose_start_date,
    )
    db_session.add(lot)
    db_session.commit()
    return med, lot


def _get_user_id(db_session):
    return db_session.query(User).filter(User.email == "test@example.com").first().id


class TestAlertsAccess:
    def test_alerts_requires_auth(self, client):
        res = client.get("/api/alerts")
        assert res.status_code == 401


class TestExpiryAlerts:
    def test_no_alerts_when_no_lots(self, seeded_client, auth_headers):
        res = seeded_client.get("/api/alerts", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert body["expiry"] == []
        assert body["depletion"] == []

    def test_expiry_alert_within_warning_period(self, seeded_client, auth_headers, db_session):
        user_id = _get_user_id(db_session)
        expiry = datetime.now(timezone.utc) + timedelta(days=10)  # within 30-day warning
        _create_med_and_lot(db_session, user_id, quantity=5, expiry_date=expiry)
        res = seeded_client.get("/api/alerts", headers=auth_headers)
        body = res.json()
        assert len(body["expiry"]) == 1
        assert body["expiry"][0]["medication_name"] == "Test Medication"
        assert body["expiry"][0]["alert_type"] == "expiry"
        assert body["expiry"][0]["days_until_expiry"] <= 10
        assert body["expiry"][0]["days_until_expiry"] >= 9

    def test_no_expiry_alert_when_far_future(self, seeded_client, auth_headers, db_session):
        user_id = _get_user_id(db_session)
        expiry = datetime.now(timezone.utc) + timedelta(days=365)
        _create_med_and_lot(db_session, user_id, quantity=5, expiry_date=expiry)
        res = seeded_client.get("/api/alerts", headers=auth_headers)
        body = res.json()
        assert len(body["expiry"]) == 0

    def test_expired_lot_shows_alert(self, seeded_client, auth_headers, db_session):
        user_id = _get_user_id(db_session)
        expiry = datetime.now(timezone.utc) - timedelta(days=5)
        _create_med_and_lot(db_session, user_id, quantity=5, expiry_date=expiry)
        res = seeded_client.get("/api/alerts", headers=auth_headers)
        body = res.json()
        assert len(body["expiry"]) == 1
        assert body["expiry"][0]["days_until_expiry"] <= 0


class TestDepletionAlerts:
    def test_depletion_alert_when_low_days_left(self, seeded_client, auth_headers, db_session):
        user_id = _get_user_id(db_session)
        # 5 units / 1.0 daily dose, started today = 5 days left (< 7-day threshold)
        _create_med_and_lot(
            db_session, user_id,
            quantity=5, daily_dose=1.0,
            dose_start_date=date.today(),
        )
        res = seeded_client.get("/api/alerts", headers=auth_headers)
        body = res.json()
        assert len(body["depletion"]) == 1
        assert body["depletion"][0]["alert_type"] == "depletion"
        assert body["depletion"][0]["days_until_depleted"] == 5.0

    def test_no_depletion_alert_when_plenty_of_stock(self, seeded_client, auth_headers, db_session):
        user_id = _get_user_id(db_session)
        # 100 units / 1.0 = 100 days left (> 7-day threshold)
        _create_med_and_lot(
            db_session, user_id,
            quantity=100, daily_dose=1.0,
            dose_start_date=date.today(),
        )
        res = seeded_client.get("/api/alerts", headers=auth_headers)
        body = res.json()
        assert len(body["depletion"]) == 0

    def test_no_depletion_alert_when_no_daily_dose(self, seeded_client, auth_headers, db_session):
        user_id = _get_user_id(db_session)
        _create_med_and_lot(db_session, user_id, quantity=1, daily_dose=None)
        res = seeded_client.get("/api/alerts", headers=auth_headers)
        body = res.json()
        assert len(body["depletion"]) == 0

    def test_no_depletion_alert_when_zero_quantity(self, seeded_client, auth_headers, db_session):
        user_id = _get_user_id(db_session)
        _create_med_and_lot(
            db_session, user_id,
            quantity=0, daily_dose=1.0,
            dose_start_date=date.today(),
        )
        res = seeded_client.get("/api/alerts", headers=auth_headers)
        body = res.json()
        assert len(body["depletion"]) == 0
