import logging
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Order
from ..schemas import OrderCreate, OrderResponse
from ..core import messaging
from ..worker import process_order

logger = logging.getLogger("order-service")
router = APIRouter(prefix="/orders", tags=["orders"])


def _get_user_id(x_user_id: str = Header(..., alias="X-User-Id")) -> str:
    """The api-gateway injects X-User-Id after validating the JWT."""
    return x_user_id


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: OrderCreate,
    user_id: str = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    if not body.items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Order must have at least one item")

    total = sum(item.quantity * item.unit_price for item in body.items)
    order = Order(
        user_id=user_id,
        total=total,
        items=[item.model_dump(mode="json") for item in body.items],
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    await messaging.publish(
        routing_key="order.created",
        payload={
            "order_id": order.id,
            "user_id": user_id,
            "total": str(order.total),
            "items": order.items,
        },
    )
    logger.info("Order created", extra={"order_id": order.id, "user_id": user_id})
    return order


@router.get("", response_model=list[OrderResponse])
async def list_orders(
    user_id: str = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order).where(Order.user_id == user_id).order_by(Order.created_at.desc())
    )
    return result.scalars().all()


@router.get("/all", response_model=list[OrderResponse])
async def list_all_orders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).order_by(Order.created_at.desc()))
    return result.scalars().all()


@router.post("/{order_id}/accept", response_model=OrderResponse)
async def accept_order(order_id: str, db: AsyncSession = Depends(get_db)):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Order is already {order.status}")
    order.status = "confirmed"
    await db.commit()
    await db.refresh(order)
    await messaging.publish(
        routing_key="order.confirmed",
        payload={"order_id": order.id, "user_id": order.user_id, "total": str(order.total)},
    )
    process_order.delay(order.id, order.items, order.user_id, str(order.total))
    logger.info("Order accepted", extra={"order_id": order.id})
    return order


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    user_id: str = Depends(_get_user_id),
    db: AsyncSession = Depends(get_db),
):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your order")
    return order
