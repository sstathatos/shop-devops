from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "notification-service"
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672/"
    otlp_endpoint: str = "http://jaeger:4318/v1/traces"
    log_level: str = "INFO"
    metrics_port: int = 8004

    class Config:
        env_file = ".env"


settings = Settings()
