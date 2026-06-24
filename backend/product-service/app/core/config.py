from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "product-service"
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/products_db"
    otlp_endpoint: str = "http://jaeger:4318/v1/traces"
    log_level: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()
