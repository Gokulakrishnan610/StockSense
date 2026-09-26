"""API routes for Member 2 inventory operations.

Mounts on the existing `router` (which already requires a valid Bearer token).

Operations follow the same pattern as Member 1's catalog routes:
  - Route validates input via Pydantic
  - Delegates to the operations service
  - Service calls apply_delta and the DB session auto-commits on success
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app import op_schemas as s
from app.dependencies import DB, CurrentUser, current_user
from app.services import operations as ops

op_router = APIRouter(dependencies=[Depends(current_user)])

Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=100)]

# ---------------------------------------------------------------------------
# RECEIPTS
# ---------------------------------------------------------------------------


@op_router.get("/receipts", response_model=list[s.ReceiptOutput], tags=["Receipts"])
def list_receipts(
    db: DB,
    status: str | None = None,
    offset: Offset = 0,
    limit: Limit = 100,
):
    return ops.list_receipts(db, status=status, offset=offset, limit=limit)


@op_router.post("/receipts", response_model=s.ReceiptOutput, status_code=201, tags=["Receipts"])
def create_receipt(data: s.ReceiptInput, db: DB, user: CurrentUser):
    return ops.create_receipt(db, supplier=data.supplier, notes=data.notes, user_id=user.id)


@op_router.get("/receipts/{id}", response_model=s.ReceiptOutput, tags=["Receipts"])
def get_receipt(id: UUID, db: DB):
    return ops.get_receipt(db, id)


@op_router.put("/receipts/{id}", response_model=s.ReceiptOutput, tags=["Receipts"])
def update_receipt(id: UUID, data: s.ReceiptInput, db: DB, user: CurrentUser):
    return ops.update_receipt(db, id, supplier=data.supplier, notes=data.notes)


@op_router.post(
    "/receipts/{id}/items",
    response_model=s.ReceiptItemOutput,
    status_code=201,
    tags=["Receipts"],
)
def add_receipt_item(id: UUID, data: s.ReceiptItemInput, db: DB, user: CurrentUser):
    return ops.add_receipt_item(
        db,
        id,
        product_id=data.product_id,
        location_id=data.location_id,
        quantity=data.quantity,
    )


@op_router.get(
    "/receipts/{id}/items",
    response_model=list[s.ReceiptItemOutput],
    tags=["Receipts"],
)
def list_receipt_items(id: UUID, db: DB):
    return ops.list_receipt_items(db, id)


@op_router.delete("/receipts/{id}/items/{item_id}", status_code=204, tags=["Receipts"])
def remove_receipt_item(id: UUID, item_id: UUID, db: DB, user: CurrentUser):
    ops.remove_receipt_item(db, id, item_id)


@op_router.post("/receipts/{id}/status", response_model=s.ReceiptOutput, tags=["Receipts"])
def update_receipt_status(id: UUID, data: s.ReceiptStatusInput, db: DB, user: CurrentUser):
    """Advance through Draft→Waiting→Ready or cancel."""
    return ops.set_receipt_status(db, id, data.status)


@op_router.post("/receipts/{id}/validate", response_model=s.ReceiptOutput, tags=["Receipts"])
def validate_receipt(id: UUID, db: DB, user: CurrentUser):
    """Validate a READY receipt → increase stock + create ledger entries."""
    return ops.validate_receipt(db, id, user_id=user.id)


# ---------------------------------------------------------------------------
# DELIVERIES
# ---------------------------------------------------------------------------


@op_router.get("/deliveries", response_model=list[s.DeliveryOutput], tags=["Deliveries"])
def list_deliveries(
    db: DB,
    status: str | None = None,
    offset: Offset = 0,
    limit: Limit = 100,
):
    return ops.list_deliveries(db, status=status, offset=offset, limit=limit)


@op_router.post(
    "/deliveries", response_model=s.DeliveryOutput, status_code=201, tags=["Deliveries"]
)
def create_delivery(data: s.DeliveryInput, db: DB, user: CurrentUser):
    return ops.create_delivery(db, notes=data.notes, user_id=user.id)


@op_router.get("/deliveries/{id}", response_model=s.DeliveryOutput, tags=["Deliveries"])
def get_delivery(id: UUID, db: DB):
    return ops.get_delivery(db, id)


@op_router.put("/deliveries/{id}", response_model=s.DeliveryOutput, tags=["Deliveries"])
def update_delivery(id: UUID, data: s.DeliveryInput, db: DB, user: CurrentUser):
    return ops.update_delivery(db, id, notes=data.notes)


@op_router.post(
    "/deliveries/{id}/items",
    response_model=s.DeliveryItemOutput,
    status_code=201,
    tags=["Deliveries"],
)
def add_delivery_item(id: UUID, data: s.DeliveryItemInput, db: DB, user: CurrentUser):
    return ops.add_delivery_item(
        db,
        id,
        product_id=data.product_id,
        location_id=data.location_id,
        quantity=data.quantity,
    )


@op_router.get(
    "/deliveries/{id}/items",
    response_model=list[s.DeliveryItemOutput],
    tags=["Deliveries"],
)
def list_delivery_items(id: UUID, db: DB):
    return ops.list_delivery_items(db, id)


@op_router.delete("/deliveries/{id}/items/{item_id}", status_code=204, tags=["Deliveries"])
def remove_delivery_item(id: UUID, item_id: UUID, db: DB, user: CurrentUser):
    ops.remove_delivery_item(db, id, item_id)


@op_router.post("/deliveries/{id}/cancel", response_model=s.DeliveryOutput, tags=["Deliveries"])
def cancel_delivery(id: UUID, db: DB, user: CurrentUser):
    """Cancel a delivery before validation; stock is not changed."""
    return ops.cancel_delivery(db, id)


@op_router.post("/deliveries/{id}/pick", response_model=s.DeliveryOutput, tags=["Deliveries"])
def pick_delivery(id: UUID, db: DB, user: CurrentUser):
    """Draft → Waiting (items have been picked)."""
    return ops.pick_delivery(db, id)


@op_router.post("/deliveries/{id}/pack", response_model=s.DeliveryOutput, tags=["Deliveries"])
def pack_delivery(id: UUID, db: DB, user: CurrentUser):
    """Waiting → Ready (goods are packed)."""
    return ops.pack_delivery(db, id)


@op_router.post("/deliveries/{id}/validate", response_model=s.DeliveryOutput, tags=["Deliveries"])
def validate_delivery(id: UUID, db: DB, user: CurrentUser):
    """Validate a READY delivery → decrease stock + create ledger entries."""
    return ops.validate_delivery(db, id, user_id=user.id)


# ---------------------------------------------------------------------------
# TRANSFERS
# ---------------------------------------------------------------------------


@op_router.get("/transfers", response_model=list[s.TransferOutput], tags=["Transfers"])
def list_transfers(
    db: DB,
    status: str | None = None,
    offset: Offset = 0,
    limit: Limit = 100,
):
    return ops.list_transfers(db, status=status, offset=offset, limit=limit)


@op_router.post("/transfers", response_model=s.TransferOutput, status_code=201, tags=["Transfers"])
def create_transfer(data: s.TransferInput, db: DB, user: CurrentUser):
    return ops.create_transfer(db, notes=data.notes, user_id=user.id)


@op_router.get("/transfers/{id}", response_model=s.TransferOutput, tags=["Transfers"])
def get_transfer(id: UUID, db: DB):
    return ops.get_transfer(db, id)


@op_router.put("/transfers/{id}", response_model=s.TransferOutput, tags=["Transfers"])
def update_transfer(id: UUID, data: s.TransferInput, db: DB, user: CurrentUser):
    return ops.update_transfer(db, id, notes=data.notes)


@op_router.post(
    "/transfers/{id}/items",
    response_model=s.TransferItemOutput,
    status_code=201,
    tags=["Transfers"],
)
def add_transfer_item(id: UUID, data: s.TransferItemInput, db: DB, user: CurrentUser):
    return ops.add_transfer_item(
        db,
        id,
        product_id=data.product_id,
        source_location_id=data.source_location_id,
        destination_location_id=data.destination_location_id,
        quantity=data.quantity,
    )


@op_router.get(
    "/transfers/{id}/items",
    response_model=list[s.TransferItemOutput],
    tags=["Transfers"],
)
def list_transfer_items(id: UUID, db: DB):
    return ops.list_transfer_items(db, id)


@op_router.delete("/transfers/{id}/items/{item_id}", status_code=204, tags=["Transfers"])
def remove_transfer_item(id: UUID, item_id: UUID, db: DB, user: CurrentUser):
    ops.remove_transfer_item(db, id, item_id)


@op_router.post("/transfers/{id}/status", response_model=s.TransferOutput, tags=["Transfers"])
def update_transfer_status(id: UUID, data: s.ReceiptStatusInput, db: DB, user: CurrentUser):
    """Advance through Draft→Waiting→Ready or cancel."""
    return ops.set_transfer_status(db, id, data.status)


@op_router.post("/transfers/{id}/validate", response_model=s.TransferOutput, tags=["Transfers"])
def validate_transfer(id: UUID, db: DB, user: CurrentUser):
    """Validate a READY transfer → move stock between locations atomically."""
    return ops.validate_transfer(db, id, user_id=user.id)


# ---------------------------------------------------------------------------
# ADJUSTMENTS
# ---------------------------------------------------------------------------


@op_router.get("/adjustments", response_model=list[s.AdjustmentOutput], tags=["Adjustments"])
def list_adjustments(
    db: DB,
    status: str | None = None,
    offset: Offset = 0,
    limit: Limit = 100,
):
    return ops.list_adjustments(db, status=status, offset=offset, limit=limit)


@op_router.post(
    "/adjustments", response_model=s.AdjustmentOutput, status_code=201, tags=["Adjustments"]
)
def create_adjustment(data: s.AdjustmentInput, db: DB, user: CurrentUser):
    return ops.create_adjustment(
        db,
        product_id=data.product_id,
        location_id=data.location_id,
        counted_quantity=data.counted_quantity,
        reason=data.reason,
        user_id=user.id,
    )


@op_router.get("/adjustments/{id}", response_model=s.AdjustmentOutput, tags=["Adjustments"])
def get_adjustment(id: UUID, db: DB):
    return ops.get_adjustment(db, id)


@op_router.post("/adjustments/{id}/cancel", response_model=s.AdjustmentOutput, tags=["Adjustments"])
def cancel_adjustment(id: UUID, db: DB, user: CurrentUser):
    """Cancel a DRAFT adjustment; stock is not changed."""
    return ops.cancel_adjustment(db, id)


@op_router.post(
    "/adjustments/{id}/validate", response_model=s.AdjustmentOutput, tags=["Adjustments"]
)
def validate_adjustment(id: UUID, db: DB, user: CurrentUser):
    """Validate a DRAFT adjustment → reconcile stock + create ledger entry."""
    return ops.validate_adjustment(db, id, user_id=user.id)


# ---------------------------------------------------------------------------
# INVENTORY LEDGER & STOCK
# ---------------------------------------------------------------------------


@op_router.get("/inventory/ledger", response_model=list[s.LedgerOutput], tags=["Inventory"])
def inventory_ledger(
    db: DB,
    product_id: UUID | None = None,
    location_id: UUID | None = None,
    transaction_type: str | None = None,
    warehouse_id: UUID | None = None,
    category_id: UUID | None = None,
    reference_id: Annotated[str | None, Query(max_length=120)] = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    offset: Offset = 0,
    limit: Limit = 100,
):
    return ops.list_ledger(
        db,
        product_id=product_id,
        location_id=location_id,
        transaction_type=transaction_type,
        warehouse_id=warehouse_id,
        category_id=category_id,
        reference_id=reference_id,
        date_from=date_from,
        date_to=date_to,
        offset=offset,
        limit=limit,
    )


@op_router.get("/inventory/stock", response_model=list[s.StockSummaryOutput], tags=["Inventory"])
def inventory_stock(
    db: DB,
    warehouse_id: UUID | None = None,
    location_id: UUID | None = None,
    offset: Offset = 0,
    limit: Limit = 100,
):
    return ops.list_stock(
        db,
        warehouse_id=warehouse_id,
        location_id=location_id,
        offset=offset,
        limit=limit,
    )


@op_router.get(
    "/inventory/stock/{product_id}",
    response_model=list[s.StockSummaryOutput],
    tags=["Inventory"],
)
def product_stock_detail(
    product_id: UUID,
    db: DB,
    warehouse_id: UUID | None = None,
    location_id: UUID | None = None,
    offset: Offset = 0,
    limit: Limit = 100,
):
    return ops.get_product_stock(
        db,
        product_id,
        warehouse_id=warehouse_id,
        location_id=location_id,
        offset=offset,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# LOW-STOCK ALERTS
# ---------------------------------------------------------------------------


@op_router.get(
    "/inventory/alerts/low-stock",
    response_model=list[s.LowStockOutput],
    tags=["Inventory"],
)
def low_stock_alerts(
    db: DB,
    offset: Offset = 0,
    limit: Limit = 100,
):
    """Products whose summed stock is at or below the configured reorder minimum."""
    return ops.list_low_stock(db, offset=offset, limit=limit)
