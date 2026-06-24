import json
import logging
import aio_pika
from .config import settings

logger = logging.getLogger("order-service")
_connection: aio_pika.abc.AbstractRobustConnection | None = None
_channel: aio_pika.abc.AbstractChannel | None = None
EXCHANGE_NAME = "shop.events"


async def connect() -> None:
    global _connection, _channel
    _connection = await aio_pika.connect_robust(settings.rabbitmq_url)
    _channel = await _connection.channel()
    await _channel.declare_exchange(EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True)
    logger.info("Connected to RabbitMQ")


async def disconnect() -> None:
    if _connection:
        await _connection.close()


async def publish(routing_key: str, payload: dict) -> None:
    if _channel is None:
        logger.warning("RabbitMQ channel not ready, skipping publish")
        return
    exchange = await _channel.get_exchange(EXCHANGE_NAME)
    message = aio_pika.Message(
        body=json.dumps(payload).encode(),
        content_type="application/json",
        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
    )
    await exchange.publish(message, routing_key=routing_key)
    logger.info("Event published", extra={"routing_key": routing_key, "payload": payload})
