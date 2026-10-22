import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    SECRET_KEY: str = "bhuverify_hackathon_super_secret_dev_key_2026_change_in_prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    DATABASE_URL: str = "sqlite:///./bhuverify.db"
    TESSERACT_CMD: str = ""
    UPLOAD_DIR: str = str(BASE_DIR / "backend" / "storage" / "uploads")
    ENVIRONMENT: str = "development"
    DEMO_DISCLAIMER: str = "Demo registry match - not an official government verification"
    PUBLIC_BASE_URL: str = "http://localhost:5173"
    QR_ALLOWLIST_DOMAINS: list[str] = [
        "upbhulekh.gov.in",
        "bhulekh.up.nic.in",
        "edistrict.up.gov.in",
        "bhuverify.gov.in",
        "localhost",
        "127.0.0.1"
    ]
    DEFAULT_SHARE_TOKEN_EXPIRE_HOURS: int = 168

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
