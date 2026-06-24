import asyncio
import json
import logging
import os
import time

import aio_pika
import httpx
from celery import Celery
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

logger = logging.getLogger("order-worker")

celery_app = Celery("order-worker", broker=os.environ.get("RABBITMQ_URL", "amqp://shopuser:shoppass@rabbitmq:5672/"))


@celery_app.task(name="orders.process_order")
def process_order(order_id: str, items: list, user_id: str = "", total: str = "0"):
    logger.info("Processing order", extra={"order_id": order_id})
    time.sleep(60)

    product_url = os.environ.get("PRODUCT_SERVICE_URL", "http://product-service:8002")
    with httpx.Client(timeout=10) as client:
        for item in items:
            try:
                resp = client.patch(
                    f"{product_url}/products/{item['product_id']}/stock",
                    json={"reduce_by": item["quantity"]},
                )
                resp.raise_for_status()
            except Exception as exc:
                logger.error("Stock reduce failed", extra={"product_id": item.get("product_id"), "error": str(exc)})

    asyncio.run(_finalize(order_id, user_id, total))


async def _finalize(order_id: str, user_id: str = "", total: str = "0"):
    from .models import Order

    db_url = os.environ["DATABASE_URL"]
    rmq_url = os.environ.get("RABBITMQ_URL", "amqp://shopuser:shoppass@rabbitmq:5672/")

    engine = create_async_engine(db_url)
    async with AsyncSession(engine) as session:
        await session.execute(update(Order).where(Order.id == order_id).values(status="completed"))
        await session.commit()
    await engine.dispose()

    conn = await aio_pika.connect_robust(rmq_url)
    channel = await conn.channel()
    exchange = await channel.declare_exchange("shop.events", aio_pika.ExchangeType.TOPIC, durable=True)
    await exchange.publish(
        aio_pika.Message(
            body=json.dumps({"order_id": order_id, "user_id": user_id, "total": total}).encode(),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        ),
        routing_key="order.completed",
    )
    await conn.close()
    logger.info("Order completed and event published", extra={"order_id": order_id})
