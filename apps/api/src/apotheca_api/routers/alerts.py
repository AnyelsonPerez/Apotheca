from datetime import date, datetime, timezone

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from apotheca_api.config import settings
from apotheca_api.database import get_db
from apotheca_api.deps import get_current_user
from apotheca_api.models import (
    Lot,
    Medication,
    NotificationLog,
    Settings as SettingsModel,
    User,
    compute_dose_consumption,
)
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
async def get_alerts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    expiry_warning_days = int(_get_setting(db, "expiry_warning_days", "30"))
    depletion_threshold_days = int(_get_setting(db, "depletion_threshold_days", "7"))

    now = datetime.now(timezone.utc)
    today_local = datetime.now().date()

    lots = (
        db.query(Lot)
        .join(Medication, Lot.medication_id == Medication.id)
        .add_columns(Medication.name, Medication.national_code)
        .filter(Lot.user_id == user.id)
        .all()
    )
    expiry_alerts: list[AlertItem] = []
    depletion_alerts: list[AlertItem] = []

    for lot, med_name, med_code in lots:
        if lot.expiry_date:
            expiry_aware = lot.expiry_date.replace(tzinfo=timezone.utc) if lot.expiry_date.tzinfo is None else lot.expiry_date
            days_until = (expiry_aware - now).days
            if days_until <= expiry_warning_days:
                expiry_alerts.append(
                    AlertItem(
                        lot_id=lot.id,
                        medication_name=med_name,
                        national_code=med_code,
                        quantity=lot.quantity,
                        expiry_date=lot.expiry_date,
                        days_until_expiry=days_until,
                        alert_type="expiry",
                    )
                )

                if days_until <= 0:
                    med = db.query(Medication).filter(Medication.id == lot.medication_id).first()
                    if med:
                        await _send_ntfy_notification(
                            db, lot, med,
                            f" caducado: {med_name} (lote {lot.id[:8]})",
                            "expiry",
                        )

        if lot.daily_dose and lot.daily_dose > 0 and lot.quantity > 0:
            effective_qty, days_left, is_consuming = compute_dose_consumption(
                lot.quantity,
                lot.daily_dose,
                lot.treatment_days,
                lot.dose_start_date,
                today_local,
            )
            if days_left is not None and days_left <= depletion_threshold_days:
                depletion_alerts.append(
                    AlertItem(
                        lot_id=lot.id,
                        medication_name=med_name,
                        national_code=med_code,
                        quantity=lot.quantity,
                        daily_dose=lot.daily_dose,
                        treatment_days=lot.treatment_days,
                        dose_start_date=lot.dose_start_date,
                        effective_quantity=round(effective_qty, 1),
                        days_until_depleted=round(days_left, 1),
                        alert_type="depletion",
                    )
                )

                if is_consuming:
                    med = db.query(Medication).filter(Medication.id == lot.medication_id).first()
                    if med and days_left <= 2:
                        await _send_ntfy_notification(
                            db, lot, med,
                            f" agotándose: {med_name} — {round(days_left, 1)} días restantes ({round(effective_qty, 1)} u)",
                            "depletion",
                        )

    return AlertsResponse(expiry=expiry_alerts, depletion=depletion_alerts)
