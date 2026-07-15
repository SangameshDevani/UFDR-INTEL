from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "UFDR Analysis Tool"
    debug: bool = True

    database_url: str = "sqlite:///./ufdr_analyzer.db"

    upload_dir: Path = Path("./data/uploads")
    extract_dir: Path = Path("./data/extracted")

    max_upload_size_mb: int = 2048

    # LLM (optional — falls back to rule-based answers when unset)
    llm_api_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str = "gpt-4o-mini"

    chunk_size: int = 20
    search_result_limit: int = 50


settings = Settings()

settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.extract_dir.mkdir(parents=True, exist_ok=True)
