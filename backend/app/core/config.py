from functools import lru_cache
from typing import List, Optional, Union

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "AI Interview Coach"
    app_env: str = "development"
    database_url: str = "sqlite+aiosqlite:///./app.db"
    openai_api_key: Optional[str] = None
    cors_origins: Union[List[AnyHttpUrl], List[str]] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, value):  # type: ignore[override]
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",")]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
