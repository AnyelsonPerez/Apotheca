"""Unit tests for the CIMA client with HTTP mocked via respx — no real network calls."""
import respx
import pytest
from httpx import Response, HTTPStatusError

from apotheca_api.cima import CIMA_BASE_URL, CimaClient


class TestCimaClientSearch:
    @respx.mock
    async def test_search_by_name_returns_results(self, mock_cima_search_response):
        respx.get(f"{CIMA_BASE_URL}/medicamentos").mock(
            return_value=Response(200, json=mock_cima_search_response)
        )
        client = CimaClient()
        data = await client.search_by_name("ibuprofeno")
        assert data["totalResultados"] == 1
        assert data["resultados"][0]["nombre"] == "Ibuprofeno Test 400mg"

    @respx.mock
    async def test_search_by_active_ingredient(self, mock_cima_search_response):
        respx.get(f"{CIMA_BASE_URL}/medicamentos").mock(
            return_value=Response(200, json=mock_cima_search_response)
        )
        client = CimaClient()
        data = await client.search_by_active_ingredient("ibuprofeno")
        assert data["totalResultados"] == 1

    @respx.mock
    async def test_search_by_cn(self, mock_cima_search_response):
        respx.get(f"{CIMA_BASE_URL}/medicamentos").mock(
            return_value=Response(200, json=mock_cima_search_response)
        )
        client = CimaClient()
        data = await client.search_by_cn("123456")
        assert len(data["resultados"]) == 1

    @respx.mock
    async def test_search_passes_page_params(self):
        route = respx.get(f"{CIMA_BASE_URL}/medicamentos").mock(
            return_value=Response(200, json={"resultados": [], "totalResultados": 0})
        )
        client = CimaClient()
        await client.search_by_name("test", page=2, page_size=50)
        request = route.calls.last.request
        assert request.url.params["pagina"] == "2"
        assert request.url.params["tamanioPagina"] == "50"


class TestCimaClientGetMedication:
    @respx.mock
    async def test_get_medication_success(self, mock_cima_medication):
        respx.get(f"{CIMA_BASE_URL}/medicamento").mock(
            return_value=Response(200, json=mock_cima_medication)
        )
        client = CimaClient()
        data = await client.get_medication("12345")
        assert data["nregistro"] == "12345"
        assert data["nombre"] == "Ibuprofeno Test 400mg"

    @respx.mock
    async def test_get_medication_404_raises_http_status_error(self):
        respx.get(f"{CIMA_BASE_URL}/medicamento").mock(
            return_value=Response(404, json={"error": "Not found"})
        )
        client = CimaClient()
        with pytest.raises(HTTPStatusError):
            await client.get_medication("nonexistent")

    @respx.mock
    async def test_get_medication_empty_body_returns_no_data(self):
        respx.get(f"{CIMA_BASE_URL}/medicamento").mock(
            return_value=Response(204, content=b"")
        )
        client = CimaClient()
        data = await client.get_medication("12345")
        assert "error" in data


class TestCimaClientErrorHandling:
    @respx.mock
    async def test_network_error_raises_exception(self):
        respx.get(f"{CIMA_BASE_URL}/medicamentos").mock(side_effect=ConnectionError("DNS failed"))
        client = CimaClient()
        with pytest.raises(Exception):
            await client.search_by_name("test")

    @respx.mock
    async def test_500_raises_http_status_error(self):
        respx.get(f"{CIMA_BASE_URL}/medicamentos").mock(
            return_value=Response(500, text="Internal Server Error")
        )
        client = CimaClient()
        with pytest.raises(HTTPStatusError):
            await client.search_by_name("test")
