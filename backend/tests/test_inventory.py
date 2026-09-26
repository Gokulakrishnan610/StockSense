from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.errors import DomainError
from app.models import StockBalance, StockLedger, User
from app.services.inventory import apply_delta


def movement(engine, catalog, **overrides):
    with Session(engine) as db:
        user_id = db.scalar(select(User.id))
    return dict(
        product_id=UUID(catalog["product"]["id"]),
        location_id=UUID(catalog["locations"][0]["id"]),
        delta=Decimal("5"),
        transaction_type="RECEIPT",
        reference_id="test-reference",
        entry_key="test-entry",
        user_id=user_id,
        **overrides,
    )


def test_idempotent_delta_and_conflicting_retry(engine, catalog):
    args = movement(engine, catalog)
    with Session(engine) as db, db.begin():
        first = apply_delta(db, **args)
        second = apply_delta(db, **args)
        assert first.id == second.id
    with Session(engine) as db, db.begin():
        with pytest.raises(DomainError, match="Entry key"):
            apply_delta(db, **{**args, "delta": Decimal("6")})
    with Session(engine) as db:
        assert db.scalar(select(StockBalance.quantity)) == Decimal("105.25")
        assert db.scalar(select(func.count()).select_from(StockLedger)) == 2


def test_delta_rollback_and_insufficient_stock(engine, catalog):
    args = movement(engine, catalog)
    with pytest.raises(RuntimeError), Session(engine) as db, db.begin():
        apply_delta(db, **args)
        raise RuntimeError("Simulate failure in caller workflow")
    with Session(engine) as db, db.begin():
        with pytest.raises(DomainError, match="Insufficient stock"):
            apply_delta(db, **{**args, "delta": Decimal("-101")})
    with Session(engine) as db:
        assert db.scalar(select(StockBalance.quantity)) == Decimal("100.25")
        assert db.scalar(select(func.count()).select_from(StockLedger)) == 1


def test_multiple_location_changes_are_atomic(engine, catalog):
    args = movement(engine, catalog)
    second_location = UUID(catalog["locations"][1]["id"])
    with Session(engine) as db, db.begin():
        apply_delta(db, **{**args, "delta": Decimal("-40"), "entry_key": "source"})
        apply_delta(
            db,
            **{
                **args,
                "location_id": second_location,
                "delta": Decimal("40"),
                "entry_key": "destination",
            },
        )
    with Session(engine) as db:
        amounts = db.scalars(select(StockBalance.quantity).order_by(StockBalance.quantity)).all()
        assert amounts == [Decimal("40"), Decimal("60.25")]
        assert sum(amounts) == Decimal("100.25")


def test_concurrent_updates_no_lost_stock(engine, catalog):
    args = movement(engine, catalog)

    def increment(i):
        with Session(engine) as db, db.begin():
            apply_delta(db, **{**args, "entry_key": f"parallel-{i}"})

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(increment, range(8)))
    with Session(engine) as db:
        assert db.scalar(select(StockBalance.quantity)) == Decimal("140.25")
        assert db.scalar(select(func.count()).select_from(StockLedger)) == 9


def test_concurrent_retry_records_once(engine, catalog):
    args = movement(engine, catalog)

    def increment(_):
        with Session(engine) as db, db.begin():
            apply_delta(db, **args)

    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(increment, range(4)))
    with Session(engine) as db:
        assert db.scalar(select(StockBalance.quantity)) == Decimal("105.25")
        assert db.scalar(select(func.count()).select_from(StockLedger)) == 2


@pytest.mark.parametrize(
    "sql",
    [
        "UPDATE stock_ledger SET quantity = quantity + 1",
        "DELETE FROM stock_ledger",
        "TRUNCATE stock_ledger",
        "UPDATE stock_balances SET quantity = -1",
    ],
)
def test_database_guards_history_and_balance(engine, catalog, sql):
    with pytest.raises(DBAPIError), engine.begin() as connection:
        connection.execute(text(sql))


def test_migration_round_trip(engine):
    with engine.begin() as connection:
        config = Config("alembic.ini")
        config.attributes["connection"] = connection
        command.downgrade(config, "base")
        command.upgrade(config, "head")
        command.check(config)
        assert connection.scalar(text("SELECT count(*) FROM roles")) == 2
