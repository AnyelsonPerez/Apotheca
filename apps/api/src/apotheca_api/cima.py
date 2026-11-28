import httpx

from apotheca_api.config import settings

CIMA_BASE_URL = "https://cima.aemps.es/cima/rest"
CIMA_TIMEOUT = 15.0


class CimaClient:
    """Async client for the AEMPS CIMA REST API."""

    def __init__(self, base_url: str = CIMA_BASE_URL, timeout: float = CIMA_TIMEOUT):
        self._base_url = base_url
        self._timeout = timeout

    async def _get(self, path: str, params: dict) -> dict:
        async with httpx.AsyncClient(base_url=self._base_url, timeout=self._timeout) as client:
            resp = await client.get(path, params=params)
            if resp.status_code == 204 or resp.content == b"":
                return {"error": "No data"}
            resp.raise_for_status()
            return resp.json()

    async def search_by_name(self, nombre: str, page: int = 1, page_size: int = 25) -> dict:
        return await self._get("/medicamentos", {"nombre": nombre, "pagina": page, "tamanioPagina": page_size})

    async def search_by_active_ingredient(self, pactivos: str, page: int = 1, page_size: int = 25) -> dict:
        return await self._get("/medicamentos", {"pactivos": pactivos, "pagina": page, "tamanioPagina": page_size})

    async def search_by_cn(self, cn: str) -> dict:
        """Search by codigo nacional de presentación (cn)."""
        return await self._get("/medicamentos", {"cn": cn})

    async def get_medication(self, nregistro: str) -> dict:
        return await self._get("/medicamento", {"nregistro": nregistro})


_client: CimaClient | None = None


def get_cima_client() -> CimaClient:
    global _client
    if _client is None:
        _client = CimaClient()
    return _client
