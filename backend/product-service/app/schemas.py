from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    description: str = ""
    price: Decimal
    stock: int = 0


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: Decimal | None = None
    stock: int | None = None


class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    price: Decimal
    stock: int
    created_at: datetime

    model_config = {"from_attributes": True}


class StockResponse(BaseModel):
    product_id: str
    stock: int


class StockReduceRequest(BaseModel):
    reduce_by: int
