from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class OrderItem(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price: Decimal


class OrderCreate(BaseModel):
    items: list[OrderItem]


class OrderResponse(BaseModel):
    id: str
    user_id: str
    status: str
    total: Decimal
    items: list[dict]
    created_at: datetime

    model_config = {"from_attributes": True}
