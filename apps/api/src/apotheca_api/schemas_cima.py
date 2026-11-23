from pydantic import BaseModel


class CimaSearchResult(BaseModel):
    nregistro: str
    nombre: str
    labtitular: str | None = None
    cpresc: str | None = None
    Comerc: bool | None = None
    receta: bool | None = None
    generico: bool | None = None
    formaFarmaceuticaSimplificada: dict | None = None
    dosis: str | None = None
    viasAdministracion: list | None = None


class CimaSearchResponse(BaseModel):
    resultados: list[CimaSearchResult] | None = None
    totalResultados: int | None = None
    pagina: int | None = None
    tamPagina: int | None = None


class CimaPresentation(BaseModel):
    cn: str | None = None
    nombre: str | None = None
    estado: str | None = None
    fechaComer: int | None = None
    fechaSusp: int | None = None


class CimaActiveIngredient(BaseModel):
    id: int | None = None
    codigo: str | None = None
    nombre: str | None = None
    cantidad: str | None = None
    unidad: str | None = None
    orden: int | None = None


class CimaMedicationDetail(BaseModel):
    nregistro: str
    nombre: str
    pactivos: str | None = None
    labtitular: str | None = None
    labcomercializador: str | None = None
    cpresc: str | None = None
    comerc: bool | None = None
    receta: bool | None = None
    generico: bool | None = None
    dosis: str | None = None
    formaFarmaceuticaSimplificada: dict | None = None
    viasAdministracion: list | None = None
    presentaciones: list[CimaPresentation] | None = None
    principiosActivos: list[CimaActiveIngredient] | None = None
    docs: list | None = None
    fotos: list | None = None


class CimaMedicationSummary(BaseModel):
    """Simplified view for the inventory and search UI."""

    nregistro: str
    nombre: str
    active_ingredient: str | None = None
    laboratory: str | None = None
    prescription: str | None = None
    dosage: str | None = None
    form: str | None = None
    commercialized: bool | None = None
