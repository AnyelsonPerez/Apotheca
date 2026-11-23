import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from apotheca_api.cima import get_cima_client
from apotheca_api.database import get_db
from apotheca_api.deps import get_current_user
from apotheca_api.models import ActiveIngredient, Lot, Medication, Presentation, User
from apotheca_api.schemas_inventory import (
    InventoryResponse,
    LotCreate,
    LotResponse,
    LotUpdate,
    MedicationCreate,
    MedicationResponse,
)

router = APIRouter(prefix="/inventory", tags=["inventory"], dependencies=[Depends(get_current_user)])


def _get_or_create_active_ingredient(db: Session, name: str) -> ActiveIngredient:
    obj = db.query(ActiveIngredient).filter(ActiveIngredient.name == name).first()
    if obj:
        return obj
    obj = ActiveIngredient(name=name)
    db.add(obj)
    db.flush()
    return obj


def _get_or_create_presentation(db: Session, name: str) -> Presentation:
    obj = db.query(Presentation).filter(Presentation.name == name).first()
    if obj:
        return obj
    obj = Presentation(name=name)
    db.add(obj)
    db.flush()
    return obj


@router.post("/medications", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
async def add_medication_from_cima(
    payload: MedicationCreate,
    db: Session = Depends(get_db),
):
    existing = db.query(Medication).filter(Medication.national_code == payload.nregistro).first()
    if existing:
        return existing

    client = get_cima_client()
    try:
        cima_data = await client.get_medication(payload.nregistro)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Error CIMA: {exc}")

    if "error" in cima_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicamento no encontrado en CIMA")

    pactivos = cima_data.get("pactivos") or "Desconocido"
    forma = cima_data.get("formaFarmaceuticaSimplificada") or {}
    forma_name = forma.get("nombre", "Otra") if isinstance(forma, dict) else "Otra"

    ai = _get_or_create_active_ingredient(db, pactivos)
    pres = _get_or_create_presentation(db, forma_name)

    med = Medication(
        national_code=cima_data.get("nregistro", payload.nregistro),
        name=cima_data.get("nombre", ""),
        laboratory=cima_data.get("labtitular"),
        dosage=cima_data.get("dosis"),
        prescription=cima_data.get("cpresc", "Sin Receta") != "Sin Receta",
        CIMA_data=json.dumps(cima_data, ensure_ascii=False),
        active_ingredient_id=ai.id,
        presentation_id=pres.id,
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


@router.get("/medications", response_model=list[MedicationResponse])
def list_medications(db: Session = Depends(get_db)):
    return db.query(Medication).all()


@router.get("/medications/{medication_id}", response_model=MedicationResponse)
def get_medication(medication_id: str, db: Session = Depends(get_db)):
    med = db.query(Medication).filter(Medication.id == medication_id).first()
    if not med:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicamento no encontrado")
    return med


@router.delete("/medications/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medication(medication_id: str, db: Session = Depends(get_db)):
    med = db.query(Medication).filter(Medication.id == medication_id).first()
    if not med:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicamento no encontrado")
    db.delete(med)
    db.commit()


@router.post("/lots", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
def create_lot(
    payload: LotCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    med = db.query(Medication).filter(Medication.id == payload.medication_id).first()
    if not med:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicamento no encontrado")

    lot = Lot(
        medication_id=payload.medication_id,
        user_id=user.id,
        quantity=payload.quantity,
        expiry_date=payload.expiry_date,
        dosage=payload.dosage,
        daily_dose=payload.daily_dose,
        acquired_at=payload.acquired_at,
    )
    db.add(lot)
    db.commit()
    db.refresh(lot)
    return lot


@router.get("/lots", response_model=list[LotResponse])
def list_lots(db: Session = Depends(get_db)):
    return db.query(Lot).all()


@router.put("/lots/{lot_id}", response_model=LotResponse)
def update_lot(lot_id: str, payload: LotUpdate, db: Session = Depends(get_db)):
    lot = db.query(Lot).filter(Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote no encontrado")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lot, key, value)
    db.commit()
    db.refresh(lot)
    return lot


@router.delete("/lots/{lot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lot(lot_id: str, db: Session = Depends(get_db)):
    lot = db.query(Lot).filter(Lot.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote no encontrado")
    db.delete(lot)
    db.commit()


@router.get("", response_model=list[InventoryResponse])
def get_inventory(db: Session = Depends(get_db)):
    medications = (
        db.query(Medication)
        .options(selectinload(Medication.lots), selectinload(Medication.active_ingredient), selectinload(Medication.presentation))
        .all()
    )
    result = []
    for med in medications:
        total_quantity = sum(lot.quantity for lot in med.lots)
        result.append(
            InventoryResponse(
                id=med.id,
                national_code=med.national_code,
                name=med.name,
                laboratory=med.laboratory,
                dosage=med.dosage,
                active_ingredient_name=med.active_ingredient.name if med.active_ingredient else None,
                presentation_name=med.presentation.name if med.presentation else None,
                total_quantity=total_quantity,
                lots=med.lots,
            )
        )
    return result
