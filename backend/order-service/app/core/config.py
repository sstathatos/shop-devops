from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "order-service"
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/orders_db"
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    product_service_url: str = "http://product-service:8002"
    otlp_endpoint: str = "http://jaeger:4318/v1/traces"
    log_level: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()
