from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.errors import DomainError, not_found
from app.models import (
    Category,
    Location,
    Product,
    ReorderRule,
    StockBalance,
    StockLedger,
    Warehouse,
)
from app.services.inventory import apply_delta


def require(db: Session, model, entity_id: UUID):
    entity = db.get(model, entity_id)
    if entity is None:
        raise not_found(model.__name__)
    return entity


def list_entities(db: Session, model, offset: int, limit: int):
    return db.scalars(select(model).order_by(model.id).offset(offset).limit(limit)).all()


def save(db: Session, model, data, entity_id: UUID | None = None):
    values = data.model_dump()
    entity = require(db, model, entity_id) if entity_id else model()
    if model is Location:
        require(db, Warehouse, values["warehouse_id"])
        if entity_id and entity.warehouse_id != values["warehouse_id"]:
            if db.scalar(
                select(StockBalance.product_id)
                .where(StockBalance.location_id == entity_id)
                .limit(1)
            ) or db.scalar(
                select(StockLedger.id).where(StockLedger.location_id == entity_id).limit(1)
            ):
                raise DomainError(409, "LOCATION_IN_USE", "Cannot move a stocked location")
    elif model is ReorderRule:
        require(db, Product, values["product_id"])
    for key, value in values.items():
        setattr(entity, key, value)
    db.add(entity)
    db.flush()
    return entity


def delete_category(db: Session, entity_id: UUID):
    entity = require(db, Category, entity_id)
    db.delete(entity)
    db.flush()


def create_product(db: Session, data: schemas.ProductCreate, user_id: UUID):
    require(db, Category, data.category_id)
    if data.initial_location_id:
        require(db, Location, data.initial_location_id)
    product = Product(**data.model_dump(exclude={"initial_location_id"}))
    db.add(product)
    db.flush()
    if data.initial_stock > 0:
        apply_delta(
            db,
            product_id=product.id,
            location_id=data.initial_location_id,
            delta=data.initial_stock,
            transaction_type="INITIAL",
            reference_id=str(product.id),
            entry_key=f"initial:{product.id}",
            user_id=user_id,
            to_location_id=data.initial_location_id,
        )
    return product


def update_product(db: Session, entity_id: UUID, data: schemas.ProductInput):
    product = db.scalar(select(Product).where(Product.id == entity_id).with_for_update())
    if not product:
        raise not_found("Product")
    require(db, Category, data.category_id)
    if product.unit_of_measure != data.unit_of_measure and db.scalar(
        select(StockLedger.id).where(StockLedger.product_id == entity_id).limit(1)
    ):
        raise DomainError(409, "UNIT_IN_USE", "Cannot change units after stock movements")
    for key, value in data.model_dump().items():
        setattr(product, key, value)
    db.flush()
    return product


def list_products(
    db: Session,
    *,
    search: str | None,
    category_id: UUID | None,
    warehouse_id: UUID | None,
    location_id: UUID | None,
    offset: int,
    limit: int,
):
    query = select(Product)
    if search:
        query = query.where(
            Product.sku.icontains(search, autoescape=True)
            | Product.name.icontains(search, autoescape=True)
        )
    if category_id:
        query = query.where(Product.category_id == category_id)
    if warehouse_id or location_id:
        stock = select(StockBalance.product_id).join(Location)
        if warehouse_id:
            stock = stock.where(Location.warehouse_id == warehouse_id)
        if location_id:
            stock = stock.where(Location.id == location_id)
        query = query.where(Product.id.in_(stock))
    return db.scalars(query.order_by(Product.sku).offset(offset).limit(limit)).all()


def stock_by_location(
    db: Session,
    product_id: UUID,
    warehouse_id: UUID | None,
    location_id: UUID | None,
    offset: int,
    limit: int,
):
    require(db, Product, product_id)
    query = select(
        StockBalance.product_id,
        StockBalance.location_id,
        Location.warehouse_id,
        StockBalance.quantity,
    ).join(Location)
    query = query.where(StockBalance.product_id == product_id)
    if warehouse_id:
        query = query.where(Location.warehouse_id == warehouse_id)
    if location_id:
        query = query.where(Location.id == location_id)
    return db.execute(query.order_by(Location.id).offset(offset).limit(limit)).mappings().all()
