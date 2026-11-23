from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="APOTHECA_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Apotheca"
    debug: bool = False

    database_path: Path = Path("data/apotheca.db")

    jwt_secret: str = "apotheca-dev-secret-change-in-production-32b"
    jwt_algorithm: str = "HS256"
    jwt_access_expires_minutes: int = 15
    jwt_refresh_expires_days: int = 30

    ntfy_url: str = ""
    ntfy_topic: str = "apotheca"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.database_path}"


settings = Settings()
