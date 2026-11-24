from datetime import datetime

from pydantic import BaseModel, Field


class LotCreate(BaseModel):
    medication_id: str
    quantity: int = Field(ge=0, default=0)
    expiry_date: datetime | None = None
    daily_dose: float | None = None
    acquired_at: datetime | None = None


class LotUpdate(BaseModel):
    quantity: int | None = Field(ge=0, default=None)
    expiry_date: datetime | None = None
    daily_dose: float | None = None
    acquired_at: datetime | None = None


class LotResponse(BaseModel):
    id: str
    medication_id: str
    user_id: str
    quantity: int
    expiry_date: datetime | None = None
    daily_dose: float | None = None
    acquired_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MedicationCreate(BaseModel):
    nregistro: str = Field(description="CIMA registration number")


class MedicationResponse(BaseModel):
    id: str
    national_code: str
    name: str
    barcode: str | None = None
    laboratory: str | None = None
    dosage: str | None = None
    prescription: bool
    active_ingredient_name: str | None = None
    presentation_name: str | None = None
    lots: list[LotResponse] = []

    model_config = {"from_attributes": True}


class InventoryResponse(BaseModel):
    id: str
    national_code: str
    name: str
    laboratory: str | None = None
    dosage: str | None = None
    active_ingredient_name: str | None = None
    presentation_name: str | None = None
    total_quantity: int
    lots: list[LotResponse] = []


class SettingsResponse(BaseModel):
    key: str
    value: str

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    value: str


class AlertItem(BaseModel):
    lot_id: str
    medication_name: str
    national_code: str
    quantity: int
    expiry_date: datetime | None = None
    daily_dose: float | None = None
    days_until_expiry: int | None = None
    days_until_depleted: float | None = None
    alert_type: str


class AlertsResponse(BaseModel):
    expiry: list[AlertItem] = []
    depletion: list[AlertItem] = []
