"""Pydantic schemas for Member 2 inventory operations.

Naming convention mirrors the pattern established in app/schemas.py:
  *Input  — request body
  *Output — response model (from_attributes=True)
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas import Input, Output, PositiveQuantity, Quantity

# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------

_VALID_STATUSES = {"DRAFT", "WAITING", "READY", "DONE", "CANCELED"}


# ---------------------------------------------------------------------------
# Receipts
# ---------------------------------------------------------------------------


class ReceiptInput(Input):
    supplier: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=1000)


class ReceiptStatusInput(Input):
    status: str

    @field_validator("status")
    @classmethod
    def valid_status(cls, value):
        if value not in _VALID_STATUSES:
            raise ValueError(f"status must be one of {sorted(_VALID_STATUSES)}")
        return value


class ReceiptItemInput(Input):
    product_id: UUID
    location_id: UUID
    quantity: PositiveQuantity


class ReceiptOutput(Output):
    id: UUID
    supplier: str
    notes: str
    status: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class ReceiptItemOutput(Output):
    id: UUID
    receipt_id: UUID
    product_id: UUID
    location_id: UUID
    quantity: Decimal


# ---------------------------------------------------------------------------
# Deliveries
# ---------------------------------------------------------------------------


class DeliveryInput(Input):
    notes: str = Field(default="", max_length=1000)


class DeliveryItemInput(Input):
    product_id: UUID
    location_id: UUID
    quantity: PositiveQuantity


class DeliveryOutput(Output):
    id: UUID
    notes: str
    status: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class DeliveryItemOutput(Output):
    id: UUID
    delivery_id: UUID
    product_id: UUID
    location_id: UUID
    quantity: Decimal


# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------


class TransferInput(Input):
    notes: str = Field(default="", max_length=1000)


class TransferItemInput(Input):
    product_id: UUID
    source_location_id: UUID
    destination_location_id: UUID
    quantity: PositiveQuantity


class TransferOutput(Output):
    id: UUID
    notes: str
    status: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class TransferItemOutput(Output):
    id: UUID
    transfer_id: UUID
    product_id: UUID
    source_location_id: UUID
    destination_location_id: UUID
    quantity: Decimal


# ---------------------------------------------------------------------------
# Adjustments
# ---------------------------------------------------------------------------


class AdjustmentInput(Input):
    product_id: UUID
    location_id: UUID
    counted_quantity: Quantity
    reason: str = Field(min_length=1, max_length=500)


class AdjustmentOutput(Output):
    id: UUID
    product_id: UUID
    location_id: UUID
    counted_quantity: Decimal
    recorded_quantity: Decimal | None
    delta: Decimal | None
    reason: str
    status: str
    created_by: UUID
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Ledger
# ---------------------------------------------------------------------------


class LedgerOutput(Output):
    id: UUID
    product_id: UUID
    location_id: UUID
    transaction_type: str
    reference_id: str
    quantity: Decimal
    before_quantity: Decimal
    after_quantity: Decimal
    from_location_id: UUID | None
    to_location_id: UUID | None
    user_id: UUID
    user_name: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------


class StockSummaryOutput(Output):
    product_id: UUID
    location_id: UUID
    warehouse_id: UUID
    quantity: Decimal


# ---------------------------------------------------------------------------
# Low-stock alerts
# ---------------------------------------------------------------------------


class LowStockOutput(Output):
    product_id: UUID
    minimum_stock: Decimal
    reorder_quantity: Decimal
    total_quantity: Decimal
