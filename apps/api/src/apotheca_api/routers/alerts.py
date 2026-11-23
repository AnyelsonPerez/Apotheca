from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from apotheca_api.config import settings
from apotheca_api.database import get_db
from apotheca_api.deps import get_current_user
from apotheca_api.models import Lot, Medication, NotificationLog, Settings as SettingsModel
from apotheca_api.schemas_inventory import AlertItem, AlertsResponse

router = APIRouter(prefix="/alerts", tags=["alerts"], dependencies=[Depends(get_current_user)])


def _get_setting(db: Session, key: str, default: str) -> str:
    row = db.query(SettingsModel).filter(SettingsModel.key == key).first()
    return row.value if row else default


async def _send_ntfy_notification(db: Session, lot: Lot, medication: Medication, message: str, alert_type: str):
    ntfy_url = _get_setting(db, "ntfy_url", settings.ntfy_url)
    ntfy_topic = _get_setting(db, "ntfy_topic", settings.ntfy_topic)
    if not ntfy_url:
        return

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{ntfy_url.rstrip('/')}/{ntfy_topic}",
                content=message,
                headers={"Title": f"Apotheca - {alert_type}", "Tags": "pill,warning"},
            )
        db.add(NotificationLog(lot_id=lot.id, notification_type=alert_type, message=message, status="sent"))
    except Exception:
        db.add(NotificationLog(lot_id=lot.id, notification_type=alert_type, message=message, status="failed"))
    db.commit()


@router.get("", response_model=AlertsResponse)
async def get_alerts(db: Session = Depends(get_db)):
    expiry_warning_days = int(_get_setting(db, "expiry_warning_days", "30"))
    depletion_threshold_days = int(_get_setting(db, "depletion_threshold_days", "7"))

    now = datetime.now(timezone.utc)
    expiry_threshold = now + timedelta(days=expiry_warning_days)

    lots = db.query(Lot).all()
    expiry_alerts: list[AlertItem] = []
    depletion_alerts: list[AlertItem] = []

    for lot in lots:
        med = db.query(Medication).filter(Medication.id == lot.medication_id).first()
        if not med:
            continue

        if lot.expiry_date:
            expiry_aware = lot.expiry_date.replace(tzinfo=timezone.utc) if lot.expiry_date.tzinfo is None else lot.expiry_date
            days_until = (expiry_aware - now).days
            if days_until <= expiry_warning_days:
                expiry_alerts.append(
                    AlertItem(
                        lot_id=lot.id,
                        medication_name=med.name,
                        national_code=med.national_code,
                        quantity=lot.quantity,
                        expiry_date=lot.expiry_date,
                        days_until_expiry=days_until,
                        alert_type="expiry",
                    )
                )

        if lot.daily_dose and lot.daily_dose > 0 and lot.quantity > 0:
            days_left = lot.quantity / lot.daily_dose
            if days_left <= depletion_threshold_days:
                depletion_alerts.append(
                    AlertItem(
                        lot_id=lot.id,
                        medication_name=med.name,
                        national_code=med.national_code,
                        quantity=lot.quantity,
                        daily_dose=lot.daily_dose,
                        days_until_depleted=round(days_left, 1),
                        alert_type="depletion",
                    )
                )

    return AlertsResponse(expiry=expiry_alerts, depletion=depletion_alerts)
