"""Seed script for E2E tests: creates a test user and a medication with a lot.

Run against a fresh API instance. Uses httpx directly — no API client SDK needed.
Usage: python e2e/fixtures/seed.py [--base-url http://localhost:8000/api]
"""
import argparse
import httpx


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
    tokens = res.json()
    access_token = tokens["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Create a medication directly in the DB via the CIMA fetch endpoint
    # We mock CIMA by creating a medication that already has a national_code
    # The E2E tests use the /cima/search endpoint which hits the real CIMA API.
    # For seed, we create a medication via the inventory endpoint.
    # NOTE: This requires CIMA to be reachable. If not, skip medication creation.
    try:
        med_res = client.post("/inventory/medications", json={"nregistro": "659818"}, headers=headers)
        if med_res.status_code == 201:
            med_id = med_res.json()["id"]
            # Create a lot for this medication
            client.post("/inventory/lots", json={
                "medication_id": med_id,
                "quantity": 30,
                "expiry_date": "2027-12-31T00:00:00",
                "daily_dose": 2.0,
            }, headers=headers)
            print(f"Seeded medication {med_id} with lot for user e2e@example.com")
    except Exception as e:
        print(f"Warning: could not seed medication (CIMA may be unreachable): {e}")

    print(f"Seed complete. User: e2e@example.com, password: e2etestpassword123")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000/api")
    args = parser.parse_args()
    seed(args.base_url)
