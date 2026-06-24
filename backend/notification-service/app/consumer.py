import asyncio
import json
import logging
import aio_pika
from opentelemetry import trace
from .core.config import settings
from .store import append_event

logger = logging.getLogger("notification-service")
tracer = trace.get_tracer("notification-service")

EXCHANGE_NAME = "shop.events"
QUEUE_NAME = "notification-service.order.events"


async def handle_event(message: aio_pika.abc.AbstractIncomingMessage) -> None:
    async with message.process():
        payload = json.loads(message.body)
        event_type = message.routing_key
        order_id = payload.get("order_id", "unknown")

        with tracer.start_as_current_span("handle_order_event") as span:
            span.set_attribute("order.id", order_id)
            span.set_attribute("event.type", event_type)
            logger.info(
                "Order event received",
                extra={"event_type": event_type, "order_id": order_id},
            )
            append_event({**payload, "event_type": event_type})


async def start_consumer() -> None:
    connection = await aio_pika.connect_robust(settings.rabbitmq_url)
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=10)
    exchange = await channel.declare_exchange(EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True)
    queue = await channel.declare_queue(QUEUE_NAME, durable=True)
    await queue.bind(exchange, routing_key="order.*")
    await queue.consume(handle_event)
    logger.info("Consumer started", extra={"queue": QUEUE_NAME, "binding": "order.*"})
    await asyncio.Future()
