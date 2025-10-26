from functools import lru_cache
from typing import List, Optional, Union

import os

from pydantic import AnyHttpUrl, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "AI Interview Coach"
    app_env: str = "development"
    database_url: str = "sqlite+aiosqlite:///./app.db"
    openai_api_key: Optional[str] = None
    llm_provider: str = "openai"
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    use_llm: Optional[bool] = None
    ci_mode: bool = False
    gen_temperature: float = 0.85
    gen_top_p: float = 0.9
    gen_presence_penalty: float = 0.7
    gen_frequency_penalty: float = 0.6
    eval_temperature: float = 0.1
    eval_top_p: float = 1.0
    eval_presence_penalty: float = 0.0
    eval_frequency_penalty: float = 0.0
    eval_max_output_tokens: int = 256
    eval_max_input_chars: int = 4000
    eval_cooldown_seconds: int = 300
    quality_debug_enabled: bool = False
    eval_model: str = "gpt-4o-mini"
    allow_llm_for_code: bool = True
    code_detection_threshold: float = 0.75
    debug_force_llm: bool = False
    cors_origins: Union[List[AnyHttpUrl], List[str]] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, value):  # type: ignore[override]
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",")]
        return value

    @model_validator(mode="after")
    def configure_llm_defaults(self):
        env = (self.app_env or "development").lower()
        provider = (self.llm_provider or "openai").lower()

        if provider not in {"openai", "custom"}:
            raise ValueError("LLM_PROVIDER must be either 'openai' or 'custom'.")
        if env not in {"local", "development", "production", "ci", "test"}:
            raise ValueError(f"Unsupported APP_ENV '{self.app_env}'. Expected one of local|development|production|ci|test.")

        ci_env_flag = env == "ci" or os.environ.get("CI", "").lower() == "true"
        base_url = (self.llm_base_url or "").strip() or None
        llm_api_key = (self.llm_api_key or "").strip() or None
        openai_key = (self.openai_api_key or "").strip() or None

        if provider == "openai":
            auto_use_llm = bool(openai_key) and not ci_env_flag
        else:
            auto_use_llm = bool(base_url) and not ci_env_flag

        resolved_use_llm = self.use_llm if self.use_llm is not None else auto_use_llm
        if resolved_use_llm and not auto_use_llm:
            # Force off if auto conditions fail (e.g., no key or CI)
            resolved_use_llm = False

        threshold = self.code_detection_threshold
        if threshold < 0.0:
            threshold = 0.0
        elif threshold > 1.0:
            threshold = 1.0

        max_input = max(1, self.eval_max_input_chars)
        max_tokens = max(1, self.eval_max_output_tokens)
        cooldown = max(0, self.eval_cooldown_seconds)

        object.__setattr__(self, "app_env", env)
        object.__setattr__(self, "llm_provider", provider)
        object.__setattr__(self, "llm_base_url", base_url)
        object.__setattr__(self, "llm_api_key", llm_api_key)
        object.__setattr__(self, "openai_api_key", openai_key)
        object.__setattr__(self, "ci_mode", ci_env_flag)
        object.__setattr__(self, "use_llm", resolved_use_llm)
        object.__setattr__(self, "code_detection_threshold", threshold)
        object.__setattr__(self, "eval_max_input_chars", max_input)
        object.__setattr__(self, "eval_max_output_tokens", max_tokens)
        object.__setattr__(self, "eval_cooldown_seconds", cooldown)

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()





