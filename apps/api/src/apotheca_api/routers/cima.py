import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from apotheca_api.cima import get_cima_client
from apotheca_api.database import get_db
from apotheca_api.deps import get_current_user
from apotheca_api.models import Lot, Medication, User

router = APIRouter(prefix="/cima", tags=["cima"], dependencies=[Depends(get_current_user)])


@router.get("/search")
async def search_medications(
    nombre: str | None = Query(None, description="Buscar por nombre comercial"),
    pactivos: str | None = Query(None, description="Buscar por principio activo"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not nombre and not pactivos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe indicar 'nombre' o 'pactivos'",
        )

    query_term = nombre or pactivos
    words = query_term.lower().split()
    cima_term = words[0]  # CIMA only supports single-word search

    # Get medication IDs that the user has lots for
    user_med_ids = {lot.medication_id for lot in db.query(Lot).filter(Lot.user_id == user.id).all()}

    # Search local inventory by name, national_code, or active ingredient
    # (only medications the user actually has in their inventory)
    local_meds = (
        db.query(Medication)
        .outerjoin(Medication.active_ingredient)
        .filter(
            Medication.id.in_(user_med_ids),
            (
                (Medication.name.ilike(f"%{query_term}%"))
                | (Medication.national_code.ilike(f"%{query_term}%"))
                | (Medication.active_ingredient.has(Medication.active_ingredient.property.mapper.class_.name.ilike(f"%{query_term}%")))
            ),
        )
        .options(selectinload(Medication.active_ingredient))
        .all()
    )
    # If multi-word, also search local by each word
    if len(words) > 1:
        for w in words[1:]:
            extra = (
                db.query(Medication)
                .outerjoin(Medication.active_ingredient)
                .filter(
                    Medication.id.in_(user_med_ids),
                    (
                        (Medication.name.ilike(f"%{w}%"))
                        | (Medication.active_ingredient.has(Medication.active_ingredient.property.mapper.class_.name.ilike(f"%{w}%")))
                    ),
                )
                .options(selectinload(Medication.active_ingredient))
                .all()
            )
            existing_ids = {m.id for m in local_meds}
            for m in extra:
                if m.id not in existing_ids:
                    local_meds.append(m)
    local_results = [
        {
            "nregistro": m.national_code,
            "nombre": m.name,
            "pactivos": m.active_ingredient.name if m.active_ingredient else None,
            "labtitular": m.laboratory,
            "dosis": m.dosage,
            "in_inventory": True,
            "medication_id": m.id,
        }
        for m in local_meds
    ]

    # Search CIMA (single word - CIMA API limitation)
    client = get_cima_client()
    try:
        if nombre:
            data = await client.search_by_name(cima_term, page, page_size)
        else:
            data = await client.search_by_active_ingredient(cima_term, page, page_size)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error consultando CIMA: {exc}",
        )

    local_nregistros = {r["nregistro"] for r in local_results}
    resultados = data.get("resultados", []) or []

    # If multi-word, filter CIMA results to match all words
    if len(words) > 1:
        filtered = []
        for m in resultados:
            nombre_lower = (m.get("nombre") or "").lower()
            pactivos_lower = (m.get("pactivos") or "").lower()
            combined = f"{nombre_lower} {pactivos_lower}"
            if all(w in combined for w in words):
                filtered.append(m)
        resultados = filtered

    cima_results = [
        {
            "nregistro": m.get("nregistro"),
            "nombre": m.get("nombre"),
            "pactivos": m.get("pactivos"),
            "labtitular": m.get("labtitular"),
            "cpresc": m.get("cpresc"),
            "comerc": m.get("comerc"),
            "dosis": m.get("dosis"),
            "in_inventory": m.get("nregistro") in local_nregistros,
        }
        for m in resultados
    ]

    return {
        "inventory": local_results,
        "cima": cima_results,
        "total_cima": data.get("totalResultados"),
        "page": data.get("pagina"),
        "page_size": data.get("tamPagina"),
    }


@router.get("/barcode/{cn}")
async def search_by_cn(cn: str, db: Session = Depends(get_db)):
    """Search CIMA by codigo nacional (scanned barcode CN).

    Spanish medication barcodes encode the 6-digit codigo nacional (CN).
    The scanner reads the full EAN-13; we extract the CN digits and look it up.
    """
    # Extract numeric digits (strip EAN-13 check digit / country prefix noise)
    digits = ''.join(c for c in cn if c.isdigit())
    # CIMA expects the 6-digit CN. EAN-13 barcodes encode it as digits 1-6.
    if len(digits) >= 6:
        cn_clean = digits[:6]
    else:
        cn_clean = digits

    client = get_cima_client()
    try:
        data = await client.search_by_cn(cn_clean)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error consultando CIMA: {exc}",
        )

    resultados = data.get("resultados", []) or []
    if not resultados:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontro medicamento con CN {cn_clean}",
        )

    med = resultados[0]
    return {
        "nregistro": med.get("nregistro"),
        "nombre": med.get("nombre"),
        "pactivos": med.get("pactivos"),
        "labtitular": med.get("labtitular"),
        "cpresc": med.get("cpresc"),
        "comerc": med.get("comerc"),
        "dosis": med.get("dosis"),
    }


@router.get("/{nregistro}")
async def get_medication_detail(nregistro: str, db: Session = Depends(get_db)):
    cached = db.query(Medication).filter(Medication.national_code == nregistro).first()
    if cached and cached.CIMA_data:
        return json.loads(cached.CIMA_data)

    client = get_cima_client()
    try:
        data = await client.get_medication(nregistro)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Error CIMA: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Error CIMA: {exc}")

    if "error" in data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medicamento no encontrado")

    return data