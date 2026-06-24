import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from .core.config import settings
from .core.logging import setup_logging
from .core.telemetry import setup_telemetry
from .consumer import start_consumer
from .routes.health import router as health_router
from .routes.events import router as events_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(start_consumer())
    yield
    task.cancel()


app = FastAPI(title="Notification Service", lifespan=lifespan)

setup_logging(settings.service_name, settings.log_level)
setup_telemetry(app, settings.service_name, settings.otlp_endpoint)
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

app.include_router(health_router)
app.include_router(events_router)
