from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from apotheca_api.database import get_db
from apotheca_api.deps import get_current_user
from apotheca_api.models import Settings as SettingsModel
from apotheca_api.schemas_inventory import SettingsResponse, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[SettingsResponse])
def list_settings(db: Session = Depends(get_db)):
    return db.query(SettingsModel).all()


@router.put("/{key}", response_model=SettingsResponse)
def update_setting(key: str, payload: SettingsUpdate, db: Session = Depends(get_db)):
    setting = db.query(SettingsModel).filter(SettingsModel.key == key).first()
    if not setting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Setting '{key}' not found")
    setting.value = payload.value
    db.commit()
    db.refresh(setting)
    return setting
