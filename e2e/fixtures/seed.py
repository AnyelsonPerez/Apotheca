"""Seed script for E2E tests: creates a test user and a medication with a lot.

Run against a fresh API instance. Registers the user via the API and inserts
the medication and lot directly into the database to avoid external CIMA
dependencies. Must be run inside the API container where the DB file lives.
Usage: python e2e/fixtures/seed.py [--base-url http://localhost:8000/api]
"""
import argparse
import json
import os
from datetime import datetime, timezone

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def _insert_medication_lot(db_url: str, user_id: str) -> None:
    """Insert a test medication and lot directly into the database."""
    from apotheca_api.database import Base
    from apotheca_api.models import Medication, Lot

    engine = create_engine(db_url)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    try:
        existing = session.query(Medication).filter(Medication.national_code == "659818").first()
        if not existing:
            med = Medication(
                id="e2e-test-med-001",
                national_code="659818",
                name="Test Medication",
                laboratory="TestLab",
                dosage="400 mg",
                prescription=False,
                CIMA_data=json.dumps({"nregistro": "659818", "nombre": "Test Medication"}),
            )
            session.add(med)
            session.flush()

            lot = Lot(
                id="e2e-test-lot-001",
                medication_id=med.id,
                user_id=user_id,
                quantity=30,
                expiry_date=datetime(2027, 12, 31, tzinfo=timezone.utc),
                daily_dose=2.0,
            )
            session.add(lot)
            session.commit()
            print(f"Seeded medication {med.id} with lot for user e2e@example.com")
    finally:
        session.close()


def seed(base_url: str = "http://localhost:8000/api") -> None:
    client = httpx.Client(base_url=base_url, timeout=30)

    # Register a test user
    res = client.post("/auth/register", json={
        "email": "e2e@example.com",
        "name": "E2E Test User",
        "password": "e2etestpassword123",
    })
    if res.status_code == 409:
        # Already exists — login instead
        res = client.post("/auth/login", json={
            "email": "e2e@example.com",
            "password": "e2etestpassword123",
        })
    res.raise_for_status()
    access_token = res.json()["access_token"]

    # Decode the JWT to get the user id (no secret verification needed for E2E seed)
    import jwt as pyjwt
    claims = pyjwt.decode(access_token, options={"verify_signature": False})
    user_id = claims["sub"]

    # Insert medication and lot directly in the DB (bypasses CIMA)
    db_path = os.environ.get("APOTHECA_DATABASE_PATH", "data/apotheca.db")
    db_url = f"sqlite:///{db_path}"
    try:
        _insert_medication_lot(db_url, user_id)
    except Exception as e:
        print(f"Warning: could not seed medication directly in DB: {e}")

    print(f"Seed complete. User: e2e@example.com, password: e2etestpassword123")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000/api")
    args = parser.parse_args()
    seed(args.base_url)
