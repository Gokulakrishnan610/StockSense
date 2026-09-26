from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str
    jwt_secret: SecretStr
    access_token_minutes: int = Field(default=30, ge=1, le=1440)
    cors_origins: list[str] = []
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_starttls: bool = True
    smtp_from: str = "stocksense@example.com"

    @field_validator("jwt_secret")
    @classmethod
    def strong_secret(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value()
        if len(raw) < 32 or raw.startswith("replace-"):
            raise ValueError("JWT_SECRET must be a random secret of at least 32 characters")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
