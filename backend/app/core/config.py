import os

class Settings:
    PROJECT_NAME: str = "Smart Schedule Builder"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "smart-schedule-builder-secret-key-2026-apple-glass")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./smart_schedule.db")

settings = Settings()
