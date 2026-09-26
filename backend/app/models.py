import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Identity:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Role(Base):
    __tablename__ = "roles"
    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    __table_args__ = (
        CheckConstraint("name IN ('INVENTORY_MANAGER', 'WAREHOUSE_STAFF')", name="valid_role"),
    )


class User(Identity, Timestamps, Base):
    __tablename__ = "users"
    login_id: Mapped[str] = mapped_column(String(64), unique=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(ForeignKey("roles.name", ondelete="RESTRICT"))
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    failed_logins: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    locked_until: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")


class PasswordReset(Base):
    __tablename__ = "password_resets"
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    otp_hash: Mapped[str] = mapped_column(String(64))
    issued_at: Mapped[int] = mapped_column(BigInteger)
    expires_at: Mapped[int] = mapped_column(BigInteger)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    reset_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True)


class Category(Identity, Timestamps, Base):
    __tablename__ = "categories"
    name: Mapped[str] = mapped_column(String(120), unique=True)


class Warehouse(Identity, Timestamps, Base):
    __tablename__ = "warehouses"
    name: Mapped[str] = mapped_column(String(120))
    short_code: Mapped[str] = mapped_column(String(32), unique=True)
    address: Mapped[str] = mapped_column(String(500), default="")


class Location(Identity, Timestamps, Base):
    __tablename__ = "locations"
    name: Mapped[str] = mapped_column(String(120))
    short_code: Mapped[str] = mapped_column(String(32))
    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("warehouses.id", ondelete="RESTRICT"), index=True
    )
    __table_args__ = (UniqueConstraint("warehouse_id", "short_code", name="uq_location_code"),)


class Product(Identity, Timestamps, Base):
    __tablename__ = "products"
    name: Mapped[str] = mapped_column(String(160))
    sku: Mapped[str] = mapped_column(String(64), unique=True)
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), index=True
    )
    unit_of_measure: Mapped[str] = mapped_column(String(32))
    initial_stock: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0, server_default="0")
    __table_args__ = (CheckConstraint("initial_stock >= 0", name="nonnegative_initial_stock"),)


class ReorderRule(Identity, Timestamps, Base):
    __tablename__ = "reorder_rules"
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), unique=True
    )
    minimum_stock: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    reorder_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    __table_args__ = (
        CheckConstraint("minimum_stock >= 0", name="nonnegative_minimum_stock"),
        CheckConstraint("reorder_quantity > 0", name="positive_reorder_quantity"),
    )


class StockBalance(Timestamps, Base):
    __tablename__ = "stock_balances"
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), primary_key=True
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT"), primary_key=True, index=True
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=0, server_default="0")
    __table_args__ = (CheckConstraint("quantity >= 0", name="nonnegative_stock"),)


class StockLedger(Identity, Base):
    __tablename__ = "stock_ledger"
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), index=True
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT"), index=True
    )
    transaction_type: Mapped[str] = mapped_column(String(32))
    reference_id: Mapped[str] = mapped_column(String(120), index=True)
    entry_key: Mapped[str] = mapped_column(String(180), unique=True)
    from_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT")
    )
    to_location_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT")
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    before_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    after_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        CheckConstraint("quantity != 0", name="nonzero_movement"),
        CheckConstraint("before_quantity >= 0 AND after_quantity >= 0", name="valid_balances"),
        CheckConstraint("after_quantity = before_quantity + quantity", name="ledger_arithmetic"),
        CheckConstraint(
            "transaction_type IN ('INITIAL', 'RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT')",
            name="valid_transaction_type",
        ),
    )


_OP_STATUSES = "status IN ('DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED')"


class Receipt(Identity, Timestamps, Base):
    """Incoming goods document.  Stock changes only when validated (DONE)."""

    __tablename__ = "receipts"
    supplier: Mapped[str] = mapped_column(String(200), default="")
    notes: Mapped[str] = mapped_column(String(1000), default="")
    status: Mapped[str] = mapped_column(String(16), default="DRAFT", server_default="DRAFT")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    __table_args__ = (CheckConstraint(_OP_STATUSES, name="receipt_valid_status"),)


class ReceiptItem(Identity, Timestamps, Base):
    __tablename__ = "receipt_items"
    receipt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("receipts.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), index=True
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT")
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    __table_args__ = (CheckConstraint("quantity > 0", name="receipt_item_positive_qty"),)


class Delivery(Identity, Timestamps, Base):
    """Outgoing goods document.  Stock changes only when validated (DONE)."""

    __tablename__ = "deliveries"
    notes: Mapped[str] = mapped_column(String(1000), default="")
    status: Mapped[str] = mapped_column(String(16), default="DRAFT", server_default="DRAFT")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    __table_args__ = (CheckConstraint(_OP_STATUSES, name="delivery_valid_status"),)


class DeliveryItem(Identity, Timestamps, Base):
    __tablename__ = "delivery_items"
    delivery_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deliveries.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), index=True
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT")
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    __table_args__ = (CheckConstraint("quantity > 0", name="delivery_item_positive_qty"),)


class Transfer(Identity, Timestamps, Base):
    """Internal stock movement between locations.  Global stock is preserved."""

    __tablename__ = "transfers"
    notes: Mapped[str] = mapped_column(String(1000), default="")
    status: Mapped[str] = mapped_column(String(16), default="DRAFT", server_default="DRAFT")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    __table_args__ = (CheckConstraint(_OP_STATUSES, name="transfer_valid_status"),)


class TransferItem(Identity, Timestamps, Base):
    __tablename__ = "transfer_items"
    transfer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("transfers.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), index=True
    )
    source_location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT")
    )
    destination_location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT")
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    __table_args__ = (CheckConstraint("quantity > 0", name="transfer_item_positive_qty"),)


class Adjustment(Identity, Timestamps, Base):
    """Physical-count correction.  Requires a reason; stock changes when validated (DONE)."""

    __tablename__ = "adjustments"
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), index=True
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("locations.id", ondelete="RESTRICT")
    )
    counted_quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    recorded_quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    delta: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    reason: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(16), default="DRAFT", server_default="DRAFT")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    __table_args__ = (
        CheckConstraint(_OP_STATUSES, name="adjustment_valid_status"),
        CheckConstraint("counted_quantity >= 0", name="adjustment_nonneg_counted"),
    )
