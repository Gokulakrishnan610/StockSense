"""member2 operations schema

Adds tables for receipts, deliveries, transfers, and adjustments.
All operations share the same five-state machine:
  DRAFT → WAITING → READY → DONE | CANCELED

Stock mutations only happen on validation (DONE transition).
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

_OP_STATUSES = "status IN ('DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED')"


def upgrade():
    op.create_table(
        "receipts",
        sa.Column("supplier", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("notes", sa.String(length=1000), nullable=False, server_default=""),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(_OP_STATUSES, name="receipt_valid_status"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "receipt_items",
        sa.Column("receipt_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("quantity > 0", name="receipt_item_positive_qty"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["receipt_id"], ["receipts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_receipt_items_receipt_id"), "receipt_items", ["receipt_id"], unique=False
    )
    op.create_index(
        op.f("ix_receipt_items_product_id"), "receipt_items", ["product_id"], unique=False
    )

    op.create_table(
        "deliveries",
        sa.Column("notes", sa.String(length=1000), nullable=False, server_default=""),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(_OP_STATUSES, name="delivery_valid_status"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "delivery_items",
        sa.Column("delivery_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("quantity > 0", name="delivery_item_positive_qty"),
        sa.ForeignKeyConstraint(["delivery_id"], ["deliveries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_delivery_items_delivery_id"), "delivery_items", ["delivery_id"], unique=False
    )
    op.create_index(
        op.f("ix_delivery_items_product_id"), "delivery_items", ["product_id"], unique=False
    )

    op.create_table(
        "transfers",
        sa.Column("notes", sa.String(length=1000), nullable=False, server_default=""),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(_OP_STATUSES, name="transfer_valid_status"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "transfer_items",
        sa.Column("transfer_id", sa.Uuid(), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("source_location_id", sa.Uuid(), nullable=False),
        sa.Column("destination_location_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("quantity > 0", name="transfer_item_positive_qty"),
        sa.ForeignKeyConstraint(["destination_location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["transfer_id"], ["transfers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_transfer_items_transfer_id"), "transfer_items", ["transfer_id"], unique=False
    )
    op.create_index(
        op.f("ix_transfer_items_product_id"), "transfer_items", ["product_id"], unique=False
    )

    op.create_table(
        "adjustments",
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("location_id", sa.Uuid(), nullable=False),
        sa.Column("counted_quantity", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("recorded_quantity", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("delta", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(_OP_STATUSES, name="adjustment_valid_status"),
        sa.CheckConstraint("counted_quantity >= 0", name="adjustment_nonneg_counted"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_adjustments_product_id"), "adjustments", ["product_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_adjustments_product_id"), table_name="adjustments")
    op.drop_table("adjustments")
    op.drop_index(op.f("ix_transfer_items_product_id"), table_name="transfer_items")
    op.drop_index(op.f("ix_transfer_items_transfer_id"), table_name="transfer_items")
    op.drop_table("transfer_items")
    op.drop_table("transfers")
    op.drop_index(op.f("ix_delivery_items_product_id"), table_name="delivery_items")
    op.drop_index(op.f("ix_delivery_items_delivery_id"), table_name="delivery_items")
    op.drop_table("delivery_items")
    op.drop_table("deliveries")
    op.drop_index(op.f("ix_receipt_items_product_id"), table_name="receipt_items")
    op.drop_index(op.f("ix_receipt_items_receipt_id"), table_name="receipt_items")
    op.drop_table("receipt_items")
    op.drop_table("receipts")
