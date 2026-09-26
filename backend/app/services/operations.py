"""Member 2 — Operations service.

Implements the business logic for:
  - Receipts (incoming goods from suppliers)
  - Deliveries (outgoing stock)
  - Internal Transfers (location-to-location moves within the company)
  - Inventory Adjustments (correcting physical vs recorded discrepancies)
  - Stock Ledger / Move History queries
  - Low-stock alert queries

All stock mutations delegate to `app.services.inventory.apply_delta`, which
owns balance updates and ledger writes.  Every validate() call wraps its
mutations in the caller's open transaction — callers hold the transaction
(FastAPI dependency or test fixture) and this module never commits.
"""

from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import DomainError, not_found
from app.models import (
    Adjustment,
    Delivery,
    DeliveryItem,
    Location,
    Product,
    Receipt,
    ReceiptItem,
    ReorderRule,
    StockBalance,
    StockLedger,
    Transfer,
    TransferItem,
)
from app.services.inventory import apply_delta

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TERMINAL = {"DONE", "CANCELED"}
_VALID_TRANSITIONS = {
    # receipts / deliveries / transfers share this state machine
    "DRAFT": {"WAITING", "CANCELED"},
    "WAITING": {"READY", "CANCELED"},
    "READY": {"DONE", "CANCELED"},
}


def _require(db: Session, model, entity_id: UUID):
    obj = db.get(model, entity_id)
    if obj is None:
        raise not_found(model.__name__)
    return obj


def _assert_not_terminal(op, name: str):
    if op.status in _TERMINAL:
        raise DomainError(
            409,
            "ALREADY_TERMINAL",
            f"{name} is already {op.status} and cannot be modified",
        )


def _assert_status(op, required: str, name: str):
    if op.status != required:
        raise DomainError(
            409,
            "INVALID_STATUS",
            f"{name} must be in '{required}' status to perform this action (current: {op.status})",
        )


# ---------------------------------------------------------------------------
# RECEIPTS
# ---------------------------------------------------------------------------


def list_receipts(db: Session, *, status: str | None, offset: int, limit: int):
    q = select(Receipt).order_by(Receipt.created_at.desc())
    if status:
        q = q.where(Receipt.status == status)
    return db.scalars(q.offset(offset).limit(limit)).all()


def get_receipt(db: Session, receipt_id: UUID) -> Receipt:
    return _require(db, Receipt, receipt_id)


def create_receipt(db: Session, *, supplier: str, notes: str, user_id: UUID) -> Receipt:
    receipt = Receipt(supplier=supplier, notes=notes, status="DRAFT", created_by=user_id)
    db.add(receipt)
    db.flush()
    return receipt


def update_receipt(
    db: Session, receipt_id: UUID, *, supplier: str, notes: str
) -> Receipt:
    receipt = _require(db, Receipt, receipt_id)
    _assert_not_terminal(receipt, "Receipt")
    receipt.supplier = supplier
    receipt.notes = notes
    db.flush()
    return receipt


def add_receipt_item(
    db: Session,
    receipt_id: UUID,
    *,
    product_id: UUID,
    location_id: UUID,
    quantity: Decimal,
) -> ReceiptItem:
    receipt = _require(db, Receipt, receipt_id)
    _assert_not_terminal(receipt, "Receipt")
    _require(db, Product, product_id)
    _require(db, Location, location_id)
    item = ReceiptItem(
        receipt_id=receipt_id,
        product_id=product_id,
        location_id=location_id,
        quantity=quantity,
    )
    db.add(item)
    db.flush()
    return item


def validate_receipt(db: Session, receipt_id: UUID, *, user_id: UUID) -> Receipt:
    """Transition receipt to DONE, increasing stock for each line atomically."""
    receipt = db.scalar(
        select(Receipt).where(Receipt.id == receipt_id).with_for_update()
    )
    if receipt is None:
        raise not_found("Receipt")
    _assert_status(receipt, "READY", "Receipt")

    items = db.scalars(
        select(ReceiptItem).where(ReceiptItem.receipt_id == receipt_id)
    ).all()
    if not items:
        raise DomainError(409, "EMPTY_OPERATION", "Receipt has no items to validate")

    # Lock all products in ascending UUID order to avoid deadlocks.
    product_ids = sorted({item.product_id for item in items})
    for pid in product_ids:
        db.scalar(select(Product.id).where(Product.id == pid).with_for_update())

    for item in items:
        apply_delta(
            db,
            product_id=item.product_id,
            location_id=item.location_id,
            delta=item.quantity,
            transaction_type="RECEIPT",
            reference_id=str(receipt_id),
            entry_key=f"receipt:{receipt_id}:{item.id}",
            user_id=user_id,
            to_location_id=item.location_id,
        )

    receipt.status = "DONE"
    db.flush()
    return receipt


def set_receipt_status(db: Session, receipt_id: UUID, new_status: str) -> Receipt:
    """Advance a receipt through Draft→Waiting→Ready or cancel it."""
    receipt = _require(db, Receipt, receipt_id)
    _assert_not_terminal(receipt, "Receipt")
    allowed = _VALID_TRANSITIONS.get(receipt.status, set())
    if new_status not in allowed:
        raise DomainError(
            409,
            "INVALID_TRANSITION",
            f"Cannot move receipt from {receipt.status} to {new_status}",
        )
    receipt.status = new_status
    db.flush()
    return receipt


# ---------------------------------------------------------------------------
# DELIVERIES
# ---------------------------------------------------------------------------


def list_deliveries(db: Session, *, status: str | None, offset: int, limit: int):
    q = select(Delivery).order_by(Delivery.created_at.desc())
    if status:
        q = q.where(Delivery.status == status)
    return db.scalars(q.offset(offset).limit(limit)).all()


def get_delivery(db: Session, delivery_id: UUID) -> Delivery:
    return _require(db, Delivery, delivery_id)


def create_delivery(db: Session, *, notes: str, user_id: UUID) -> Delivery:
    delivery = Delivery(notes=notes, status="DRAFT", created_by=user_id)
    db.add(delivery)
    db.flush()
    return delivery


def update_delivery(db: Session, delivery_id: UUID, *, notes: str) -> Delivery:
    delivery = _require(db, Delivery, delivery_id)
    _assert_not_terminal(delivery, "Delivery")
    delivery.notes = notes
    db.flush()
    return delivery


def add_delivery_item(
    db: Session,
    delivery_id: UUID,
    *,
    product_id: UUID,
    location_id: UUID,
    quantity: Decimal,
) -> DeliveryItem:
    delivery = _require(db, Delivery, delivery_id)
    _assert_not_terminal(delivery, "Delivery")
    _require(db, Product, product_id)
    _require(db, Location, location_id)
    item = DeliveryItem(
        delivery_id=delivery_id,
        product_id=product_id,
        location_id=location_id,
        quantity=quantity,
    )
    db.add(item)
    db.flush()
    return item


def pick_delivery(db: Session, delivery_id: UUID) -> Delivery:
    delivery = _require(db, Delivery, delivery_id)
    _assert_status(delivery, "DRAFT", "Delivery")
    delivery.status = "WAITING"
    db.flush()
    return delivery


def pack_delivery(db: Session, delivery_id: UUID) -> Delivery:
    delivery = _require(db, Delivery, delivery_id)
    _assert_status(delivery, "WAITING", "Delivery")
    delivery.status = "READY"
    db.flush()
    return delivery


def validate_delivery(db: Session, delivery_id: UUID, *, user_id: UUID) -> Delivery:
    """Transition delivery to DONE, decreasing stock atomically."""
    delivery = db.scalar(
        select(Delivery).where(Delivery.id == delivery_id).with_for_update()
    )
    if delivery is None:
        raise not_found("Delivery")
    _assert_status(delivery, "READY", "Delivery")

    items = db.scalars(
        select(DeliveryItem).where(DeliveryItem.delivery_id == delivery_id)
    ).all()
    if not items:
        raise DomainError(409, "EMPTY_OPERATION", "Delivery has no items to validate")

    # Lock all products in ascending UUID order to avoid deadlocks.
    product_ids = sorted({item.product_id for item in items})
    for pid in product_ids:
        db.scalar(select(Product.id).where(Product.id == pid).with_for_update())

    for item in items:
        apply_delta(
            db,
            product_id=item.product_id,
            location_id=item.location_id,
            delta=-item.quantity,  # negative: stock leaves
            transaction_type="DELIVERY",
            reference_id=str(delivery_id),
            entry_key=f"delivery:{delivery_id}:{item.id}",
            user_id=user_id,
            from_location_id=item.location_id,
        )

    delivery.status = "DONE"
    db.flush()
    return delivery


# ---------------------------------------------------------------------------
# INTERNAL TRANSFERS
# ---------------------------------------------------------------------------


def list_transfers(db: Session, *, status: str | None, offset: int, limit: int):
    q = select(Transfer).order_by(Transfer.created_at.desc())
    if status:
        q = q.where(Transfer.status == status)
    return db.scalars(q.offset(offset).limit(limit)).all()


def get_transfer(db: Session, transfer_id: UUID) -> Transfer:
    return _require(db, Transfer, transfer_id)


def create_transfer(db: Session, *, notes: str, user_id: UUID) -> Transfer:
    transfer = Transfer(notes=notes, status="DRAFT", created_by=user_id)
    db.add(transfer)
    db.flush()
    return transfer


def update_transfer(db: Session, transfer_id: UUID, *, notes: str) -> Transfer:
    transfer = _require(db, Transfer, transfer_id)
    _assert_not_terminal(transfer, "Transfer")
    transfer.notes = notes
    db.flush()
    return transfer


def add_transfer_item(
    db: Session,
    transfer_id: UUID,
    *,
    product_id: UUID,
    source_location_id: UUID,
    destination_location_id: UUID,
    quantity: Decimal,
) -> TransferItem:
    transfer = _require(db, Transfer, transfer_id)
    _assert_not_terminal(transfer, "Transfer")
    _require(db, Product, product_id)
    _require(db, Location, source_location_id)
    _require(db, Location, destination_location_id)
    if source_location_id == destination_location_id:
        raise DomainError(
            422,
            "SAME_LOCATION",
            "Source and destination locations must be different",
        )
    item = TransferItem(
        transfer_id=transfer_id,
        product_id=product_id,
        source_location_id=source_location_id,
        destination_location_id=destination_location_id,
        quantity=quantity,
    )
    db.add(item)
    db.flush()
    return item


def set_transfer_status(db: Session, transfer_id: UUID, new_status: str) -> Transfer:
    transfer = _require(db, Transfer, transfer_id)
    _assert_not_terminal(transfer, "Transfer")
    allowed = _VALID_TRANSITIONS.get(transfer.status, set())
    if new_status not in allowed:
        raise DomainError(
            409,
            "INVALID_TRANSITION",
            f"Cannot move transfer from {transfer.status} to {new_status}",
        )
    transfer.status = new_status
    db.flush()
    return transfer


def validate_transfer(db: Session, transfer_id: UUID, *, user_id: UUID) -> Transfer:
    """Move stock from source to destination for each line atomically.

    Global stock is preserved: source balance decreases by the same amount
    that destination balance increases.
    """
    transfer = db.scalar(
        select(Transfer).where(Transfer.id == transfer_id).with_for_update()
    )
    if transfer is None:
        raise not_found("Transfer")
    _assert_status(transfer, "READY", "Transfer")

    items = db.scalars(
        select(TransferItem).where(TransferItem.transfer_id == transfer_id)
    ).all()
    if not items:
        raise DomainError(409, "EMPTY_OPERATION", "Transfer has no items to validate")

    # Lock all products in ascending UUID order.
    product_ids = sorted({item.product_id for item in items})
    for pid in product_ids:
        db.scalar(select(Product.id).where(Product.id == pid).with_for_update())

    for item in items:
        ref = str(transfer_id)
        # Deduct from source
        apply_delta(
            db,
            product_id=item.product_id,
            location_id=item.source_location_id,
            delta=-item.quantity,
            transaction_type="TRANSFER",
            reference_id=ref,
            entry_key=f"transfer:{transfer_id}:{item.id}:src",
            user_id=user_id,
            from_location_id=item.source_location_id,
            to_location_id=item.destination_location_id,
        )
        # Add to destination
        apply_delta(
            db,
            product_id=item.product_id,
            location_id=item.destination_location_id,
            delta=item.quantity,
            transaction_type="TRANSFER",
            reference_id=ref,
            entry_key=f"transfer:{transfer_id}:{item.id}:dst",
            user_id=user_id,
            from_location_id=item.source_location_id,
            to_location_id=item.destination_location_id,
        )

    transfer.status = "DONE"
    db.flush()
    return transfer


# ---------------------------------------------------------------------------
# INVENTORY ADJUSTMENTS
# ---------------------------------------------------------------------------


def list_adjustments(db: Session, *, status: str | None, offset: int, limit: int):
    q = select(Adjustment).order_by(Adjustment.created_at.desc())
    if status:
        q = q.where(Adjustment.status == status)
    return db.scalars(q.offset(offset).limit(limit)).all()


def get_adjustment(db: Session, adjustment_id: UUID) -> Adjustment:
    return _require(db, Adjustment, adjustment_id)


def create_adjustment(
    db: Session,
    *,
    product_id: UUID,
    location_id: UUID,
    counted_quantity: Decimal,
    reason: str,
    user_id: UUID,
) -> Adjustment:
    """Create an adjustment in DRAFT; does not touch stock yet."""
    _require(db, Product, product_id)
    _require(db, Location, location_id)
    if not reason or not reason.strip():
        raise DomainError(422, "REASON_REQUIRED", "A reason is required for adjustments")
    adjustment = Adjustment(
        product_id=product_id,
        location_id=location_id,
        counted_quantity=counted_quantity,
        reason=reason,
        status="DRAFT",
        created_by=user_id,
    )
    db.add(adjustment)
    db.flush()
    return adjustment


def validate_adjustment(
    db: Session, adjustment_id: UUID, *, user_id: UUID
) -> Adjustment:
    """Calculate the difference between recorded and counted qty, update stock."""
    adjustment = db.scalar(
        select(Adjustment).where(Adjustment.id == adjustment_id).with_for_update()
    )
    if adjustment is None:
        raise not_found("Adjustment")
    _assert_status(adjustment, "DRAFT", "Adjustment")

    # Lock the product row.
    db.scalar(
        select(Product.id)
        .where(Product.id == adjustment.product_id)
        .with_for_update()
    )

    balance = db.get(StockBalance, (adjustment.product_id, adjustment.location_id))
    recorded = balance.quantity if balance else Decimal("0")
    delta = adjustment.counted_quantity - recorded
    adjustment.recorded_quantity = recorded
    adjustment.delta = delta

    if delta == 0:
        # Nothing to do; just mark done without a ledger entry.
        adjustment.status = "DONE"
        db.flush()
        return adjustment

    apply_delta(
        db,
        product_id=adjustment.product_id,
        location_id=adjustment.location_id,
        delta=delta,
        transaction_type="ADJUSTMENT",
        reference_id=str(adjustment_id),
        entry_key=f"adjustment:{adjustment_id}",
        user_id=user_id,
    )

    adjustment.status = "DONE"
    db.flush()
    return adjustment


# ---------------------------------------------------------------------------
# STOCK LEDGER / INVENTORY QUERIES
# ---------------------------------------------------------------------------


def list_ledger(
    db: Session,
    *,
    product_id: UUID | None,
    location_id: UUID | None,
    transaction_type: str | None,
    offset: int,
    limit: int,
):
    q = select(StockLedger).order_by(StockLedger.created_at.desc())
    if product_id:
        q = q.where(StockLedger.product_id == product_id)
    if location_id:
        q = q.where(StockLedger.location_id == location_id)
    if transaction_type:
        q = q.where(StockLedger.transaction_type == transaction_type)
    return db.scalars(q.offset(offset).limit(limit)).all()


def list_stock(
    db: Session,
    *,
    warehouse_id: UUID | None,
    location_id: UUID | None,
    offset: int,
    limit: int,
):
    from app.models import Location as Loc

    q = select(
        StockBalance.product_id,
        StockBalance.location_id,
        Loc.warehouse_id,
        StockBalance.quantity,
    ).join(Loc)
    if warehouse_id:
        q = q.where(Loc.warehouse_id == warehouse_id)
    if location_id:
        q = q.where(StockBalance.location_id == location_id)
    return db.execute(
        q.order_by(StockBalance.product_id, StockBalance.location_id)
        .offset(offset)
        .limit(limit)
    ).mappings().all()


def get_product_stock(
    db: Session,
    product_id: UUID,
    *,
    warehouse_id: UUID | None,
    location_id: UUID | None,
    offset: int,
    limit: int,
):
    from app.models import Location as Loc

    _require(db, Product, product_id)
    q = select(
        StockBalance.product_id,
        StockBalance.location_id,
        Loc.warehouse_id,
        StockBalance.quantity,
    ).join(Loc).where(StockBalance.product_id == product_id)
    if warehouse_id:
        q = q.where(Loc.warehouse_id == warehouse_id)
    if location_id:
        q = q.where(StockBalance.location_id == location_id)
    return db.execute(
        q.order_by(Loc.id).offset(offset).limit(limit)
    ).mappings().all()


# ---------------------------------------------------------------------------
# LOW-STOCK ALERTS
# ---------------------------------------------------------------------------


def list_low_stock(db: Session, *, offset: int, limit: int):
    """Return products whose total stock is at or below their reorder minimum."""
    total_stock = (
        select(
            StockBalance.product_id,
            func.sum(StockBalance.quantity).label("total_quantity"),
        )
        .group_by(StockBalance.product_id)
        .subquery()
    )
    q = (
        select(
            ReorderRule.product_id,
            ReorderRule.minimum_stock,
            ReorderRule.reorder_quantity,
            func.coalesce(total_stock.c.total_quantity, Decimal("0")).label(
                "total_quantity"
            ),
        )
        .outerjoin(total_stock, ReorderRule.product_id == total_stock.c.product_id)
        .where(
            func.coalesce(total_stock.c.total_quantity, Decimal("0"))
            <= ReorderRule.minimum_stock
        )
        .order_by(ReorderRule.product_id)
        .offset(offset)
        .limit(limit)
    )
    return db.execute(q).mappings().all()
