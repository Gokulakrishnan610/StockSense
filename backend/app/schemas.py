from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

Name = Annotated[str, Field(min_length=1, max_length=120)]
Code = Annotated[str, Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9_-]+$")]
Quantity = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=4)]
PositiveQuantity = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=4)]
Password = Annotated[str, Field(min_length=10, max_length=128)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def trim_text(cls, value, info):
        if isinstance(value, str) and info.field_name not in {"password", "new_password"}:
            return value.strip()
        return value


class Output(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Signup(Input):
    login_id: Annotated[str, Field(min_length=6, max_length=64, pattern=r"^[a-zA-Z0-9_.-]+$")]
    email: EmailStr
    name: Name
    password: Password

    @field_validator("login_id", "email")
    @classmethod
    def lowercase(cls, value):
        return value.lower()


class Login(Input):
    login_id: Annotated[str, Field(min_length=1, max_length=254)]
    password: Annotated[str, Field(min_length=1, max_length=128)]


class EmailInput(Input):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def lowercase(cls, value):
        return value.lower()


class VerifyOTP(EmailInput):
    otp: Annotated[str, Field(pattern=r"^\d{6}$")]


class ResetPassword(Input):
    reset_token: Annotated[str, Field(min_length=32, max_length=128)]
    new_password: Password


class Profile(Output):
    id: UUID
    login_id: str
    email: str
    name: str
    role: str


class Token(Output):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    redirect_to: str = "/dashboard"


class CategoryInput(Input):
    name: Name


class CategoryOutput(Output):
    id: UUID
    name: str


class WarehouseInput(Input):
    name: Name
    short_code: Code
    address: Annotated[str, Field(max_length=500)] = ""

    @field_validator("short_code")
    @classmethod
    def uppercase(cls, value):
        return value.upper()


class WarehouseOutput(Output):
    id: UUID
    name: str
    short_code: str
    address: str


class LocationInput(Input):
    name: Name
    short_code: Code
    warehouse_id: UUID

    @field_validator("short_code")
    @classmethod
    def uppercase(cls, value):
        return value.upper()


class LocationOutput(Output):
    id: UUID
    name: str
    short_code: str
    warehouse_id: UUID


class ProductInput(Input):
    name: Annotated[str, Field(min_length=1, max_length=160)]
    sku: Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")]
    category_id: UUID
    unit_of_measure: Annotated[str, Field(min_length=1, max_length=32)]

    @field_validator("sku")
    @classmethod
    def uppercase(cls, value):
        return value.upper()


class ProductCreate(ProductInput):
    initial_stock: Quantity = Decimal(0)
    initial_location_id: UUID | None = None

    @model_validator(mode="after")
    def opening_location(self):
        if self.initial_stock > 0 and self.initial_location_id is None:
            raise ValueError("initial_location_id is required for positive initial stock")
        return self


class ProductOutput(Output):
    id: UUID
    name: str
    sku: str
    category_id: UUID
    unit_of_measure: str
    initial_stock: Decimal
    created_at: datetime
    updated_at: datetime


class StockOutput(Output):
    product_id: UUID
    location_id: UUID
    warehouse_id: UUID
    quantity: Decimal


class ReorderInput(Input):
    product_id: UUID
    minimum_stock: Quantity
    reorder_quantity: PositiveQuantity


class ReorderOutput(Output):
    id: UUID
    product_id: UUID
    minimum_stock: Decimal
    reorder_quantity: Decimal
