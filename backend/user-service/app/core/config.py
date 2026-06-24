from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "user-service"
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/users_db"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    otlp_endpoint: str = "http://jaeger:4318/v1/traces"
    log_level: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()
