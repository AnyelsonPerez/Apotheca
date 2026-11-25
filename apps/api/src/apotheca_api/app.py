from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from apotheca_api.database import Base, engine, get_db
from apotheca_api.routers import alerts, auth, cima, inventory, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from apotheca_api.seed import seed_settings
    db = next(get_db())
    try:
        seed_settings(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Apotheca API",
    description="Self-hosted pharmacy management API",
    version="0.1.0",
    lifespan=lifespan,
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://apotheca.anyelson.mywire.org",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(cima.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")


@app.get("/api/health")
async def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return {"status": "degraded", "database": "error"}
