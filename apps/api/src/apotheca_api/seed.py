from sqlalchemy.orm import Session

from apotheca_api.database import SessionLocal
from apotheca_api.models import Settings

DEFAULT_SETTINGS = {
    "expiry_warning_days": "30",
    "depletion_threshold_days": "7",
    "ntfy_topic": "apotheca",
    "ntfy_url": "",
}


def seed_settings(db: Session) -> None:
    for key, value in DEFAULT_SETTINGS.items():
        existing = db.query(Settings).filter(Settings.key == key).first()
        if not existing:
            db.add(Settings(key=key, value=value))
    db.commit()


def run_seed() -> None:
    db = SessionLocal()
    try:
        seed_settings(db)
        print(f"Seeded {len(DEFAULT_SETTINGS)} default settings")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
