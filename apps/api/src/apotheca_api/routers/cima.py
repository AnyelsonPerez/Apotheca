import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from apotheca_api.cima import get_cima_client
from apotheca_api.database import get_db
from apotheca_api.models import Medication

router = APIRouter(prefix="/cima", tags=["cima"])


@router.get("/search")
async def search_medications(
    nombre: str | None = Query(None, description="Buscar por nombre comercial"),
    pactivos: str | None = Query(None, description="Buscar por principio activo"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    if not nombre and not pactivos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe indicar 'nombre' o 'pactivos'",
        )

    client = get_cima_client()
    try:
        if nombre:
            data = await client.search_by_name(nombre, page, page_size)
        else:
            data = await client.search_by_active_ingredient(pactivos, page, page_size)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error consultando CIMA: {exc}",
        )

    resultados = data.get("resultados", []) or []
    items = [
        {
            "nregistro": m.get("nregistro"),
            "nombre": m.get("nombre"),
            "labtitular": m.get("labtitular"),
            "cpresc": m.get("cpresc"),
            "comerc": m.get("comerc"),
            "dosis": m.get("dosis"),
        }
        for m in resultados
    ]
    return {
        "resultados": items,
        "total": data.get("totalResultados"),
        "page": data.get("pagina"),
        "page_size": data.get("tamPagina"),
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
