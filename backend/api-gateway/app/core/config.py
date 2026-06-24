from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "api-gateway"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    user_service_url: str = "http://user-service:8001"
    product_service_url: str = "http://product-service:8002"
    order_service_url: str = "http://order-service:8003"
    notification_service_url: str = "http://notification-service:8004"
    otlp_endpoint: str = "http://jaeger:4318/v1/traces"
    log_level: str = "INFO"

    class Config:
        env_file = ".env"


settings = Settings()
