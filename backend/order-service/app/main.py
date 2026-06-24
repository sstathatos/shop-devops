from contextlib import asynccontextmanager
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from .core.config import settings
from .core.logging import setup_logging
from .core.telemetry import setup_telemetry
from .core import messaging
from .database import init_db
from .routes.health import router as health_router
from .routes.orders import router as orders_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await messaging.connect()
    yield
    await messaging.disconnect()


app = FastAPI(title="Order Service", lifespan=lifespan)

setup_logging(settings.service_name, settings.log_level)
setup_telemetry(app, settings.service_name, settings.otlp_endpoint)
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

app.include_router(health_router)
app.include_router(orders_router)
