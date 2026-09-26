from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import DomainError, not_found
from app.models import Location, Product, StockBalance, StockLedger


def apply_delta(
    db: Session,
    *,
    product_id: UUID,
    location_id: UUID,
    delta: Decimal,
    transaction_type: str,
    reference_id: str,
    entry_key: str,
    user_id: UUID,
    from_location_id: UUID | None = None,
    to_location_id: UUID | None = None,
) -> StockLedger:
    """Append one location movement; caller owns the transaction, never commit here.

    Lock products in UUID order before multi-product operations. Transfers call this
    twice with distinct stable entry keys inside the same transaction.
    """
    if (
        not delta.is_finite()
        or delta == 0
        or abs(delta) >= Decimal("100000000000000")
        or delta != delta.quantize(Decimal("0.0001"))
    ):
        raise DomainError(422, "INVALID_QUANTITY", "Use a nonzero quantity with up to 4 decimals")
    if transaction_type not in {"INITIAL", "RECEIPT", "DELIVERY", "TRANSFER", "ADJUSTMENT"}:
        raise DomainError(422, "INVALID_MOVEMENT", "Unknown movement type")
    if not db.scalar(select(Product.id).where(Product.id == product_id).with_for_update()):
        raise not_found("Product")
    existing = db.scalar(select(StockLedger).where(StockLedger.entry_key == entry_key))
    if existing:
        expected = (
            product_id,
            location_id,
            delta,
            transaction_type,
            reference_id,
            user_id,
            from_location_id,
            to_location_id,
        )
        actual = (
            existing.product_id,
            existing.location_id,
            existing.quantity,
            existing.transaction_type,
            existing.reference_id,
            existing.user_id,
            existing.from_location_id,
            existing.to_location_id,
        )
        if actual != expected:
            raise DomainError(409, "IDEMPOTENCY_CONFLICT", "Entry key already has different data")
        return existing
    for location in {location_id, from_location_id, to_location_id} - {None}:
        if not db.get(Location, location):
            raise not_found("Location")
    balance = db.get(StockBalance, (product_id, location_id), populate_existing=True)
    before = balance.quantity if balance else Decimal(0)
    after = before + delta
    if after < 0:
        raise DomainError(409, "INSUFFICIENT_STOCK", "Insufficient stock at this location")
    if after >= Decimal("100000000000000"):
        raise DomainError(422, "INVALID_QUANTITY", "Result exceeds supported stock quantity")
    if balance is None:
        balance = StockBalance(product_id=product_id, location_id=location_id)
        db.add(balance)
    balance.quantity = after
    entry = StockLedger(
        product_id=product_id,
        location_id=location_id,
        quantity=delta,
        before_quantity=before,
        after_quantity=after,
        transaction_type=transaction_type,
        reference_id=reference_id,
        entry_key=entry_key,
        user_id=user_id,
        from_location_id=from_location_id,
        to_location_id=to_location_id,
    )
    db.add(entry)
    db.flush()
    return entry
