import httpx

from apotheca_api.config import settings

CIMA_BASE_URL = "https://cima.aemps.es/cima/rest"
CIMA_TIMEOUT = 15.0


class CimaClient:
    """Async client for the AEMPS CIMA REST API."""

    def __init__(self, base_url: str = CIMA_BASE_URL, timeout: float = CIMA_TIMEOUT):
        self._client = httpx.AsyncClient(base_url=base_url, timeout=timeout)

    async def search_by_name(self, nombre: str, page: int = 1, page_size: int = 25) -> dict:
        resp = await self._client.get(
            "/medicamentos",
            params={"nombre": nombre, "pagina": page, "tamanioPagina": page_size},
        )
        resp.raise_for_status()
        return resp.json()

    async def search_by_active_ingredient(self, pactivos: str, page: int = 1, page_size: int = 25) -> dict:
        resp = await self._client.get(
            "/medicamentos",
            params={"pactivos": pactivos, "pagina": page, "tamanioPagina": page_size},
        )
        resp.raise_for_status()
        return resp.json()

    async def get_medication(self, nregistro: str) -> dict:
        resp = await self._client.get("/medicamento", params={"nregistro": nregistro})
        resp.raise_for_status()
        return resp.json()

    async def aclose(self):
        await self._client.aclose()


_client: CimaClient | None = None


def get_cima_client() -> CimaClient:
    global _client
    if _client is None:
        _client = CimaClient()
    return _client
