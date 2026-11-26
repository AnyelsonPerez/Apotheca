"""Test fixtures: in-memory SQLite, TestClient, CIMA mock — zero disk artifacts."""
from collections.abc import Generator
from contextlib import asynccontextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from apotheca_api.app import app
from apotheca_api.database import Base, get_db
from apotheca_api.models import Settings, User
from apotheca_api.seed import DEFAULT_SETTINGS, seed_settings
from apotheca_api.security import create_access_token, hash_password


@asynccontextmanager
async def _noop_lifespan(app):
    yield


@pytest.fixture
def db_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(db_engine) -> Generator[Session, None, None]:
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    seed_settings(session)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    app.router.lifespan_context = _noop_lifespan
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def seeded_client(db_session) -> Generator[TestClient, None, None]:
    """Client with a pre-registered user for auth-protected endpoints."""
    user = User(
        email="test@example.com",
        name="Test User",
        password_hash=hash_password("testpassword123"),
        is_admin=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    app.router.lifespan_context = _noop_lifespan
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(seeded_client, db_session) -> dict[str, str]:
    """Headers with a valid access token for the seeded user."""
    user = db_session.query(User).filter(User.email == "test@example.com").first()
    token = create_access_token(user.id, extra={"email": user.email, "admin": user.is_admin})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_cima_medication():
    return {
        "nregistro": "12345",
        "nombre": "Ibuprofeno Test 400mg",
        "pactivos": "Ibuprofeno",
        "labtitular": "TestLab SA",
        "dosis": "400 mg",
        "cpresc": "Sin Receta",
        "formaFarmaceuticaSimplificada": {"nombre": "Comprimido"},
        "comerc": True,
    }


@pytest.fixture
def mock_cima_search_response():
    return {
        "resultados": [
            {
                "nregistro": "12345",
                "nombre": "Ibuprofeno Test 400mg",
                "pactivos": "Ibuprofeno",
                "labtitular": "TestLab SA",
                "dosis": "400 mg",
                "cpresc": "Sin Receta",
                "comerc": True,
            }
        ],
        "totalResultados": 1,
        "pagina": 1,
        "tamPagina": 25,
    }


class MockCimaClient:
    """Drop-in CimaClient that returns canned data without HTTP."""

    def __init__(self, medication_data=None, search_response=None):
        self._med = medication_data or {}
        self._search = search_response or {
            "resultados": [],
            "totalResultados": 0,
            "pagina": 1,
            "tamPagina": 25,
        }

    async def get_medication(self, nregistro):
        return self._med

    async def search_by_name(self, nombre, page=1, page_size=25):
        return self._search

    async def search_by_active_ingredient(self, pactivos, page=1, page_size=25):
        return self._search

    async def search_by_cn(self, cn):
        return self._search


@pytest.fixture
def patch_cima(mock_cima_medication):
    """Patch get_cima_client at the router module level so inventory routes use the mock."""
    from apotheca_api.routers import inventory, cima
    mock = MockCimaClient(medication_data=mock_cima_medication)
    original_inventory = inventory.get_cima_client
    original_cima = cima.get_cima_client
    inventory.get_cima_client = lambda: mock
    cima.get_cima_client = lambda: mock
    yield mock
    inventory.get_cima_client = original_inventory
    cima.get_cima_client = original_cima
