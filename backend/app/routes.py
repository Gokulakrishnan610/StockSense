from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select

from app import schemas as s
from app.config import get_settings
from app.dependencies import DB, CurrentUser, Manager, current_user
from app.errors import DomainError
from app.models import Category, Location, Product, ReorderRule, Warehouse
from app.services import auth, catalog

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
router = APIRouter(dependencies=[Depends(current_user)])
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=100)]


@auth_router.post("/signup", response_model=s.Profile, status_code=201)
def signup(data: s.Signup, db: DB):
    return auth.signup(db, data)


@auth_router.post("/login", response_model=s.Token)
def login(data: s.Login, db: DB):
    return auth.login(db, data.login_id, data.password)


@auth_router.post("/forgot-password", status_code=202)
def forgot_password(data: s.EmailInput, db: DB):
    if not get_settings().smtp_host:
        raise DomainError(503, "MAIL_UNAVAILABLE", "Password reset delivery is not configured")
    auth.forgot_password(db, data.email)
    return {"message": "If the account exists, a reset code will be sent"}


@auth_router.post("/verify-otp")
def verify_otp(data: s.VerifyOTP, db: DB):
    return auth.verify_otp(db, data.email, data.otp)


@auth_router.post("/reset-password", status_code=204)
def reset_password(data: s.ResetPassword, db: DB):
    auth.reset_password(db, data.reset_token, data.new_password)
    return Response(status_code=204)


@auth_router.post("/logout", status_code=204)
def logout(db: DB, user: CurrentUser):
    auth.logout(db, user)
    return Response(status_code=204)


@auth_router.get("/me", response_model=s.Profile)
def profile(user: CurrentUser):
    return user


@router.get("/categories", response_model=list[s.CategoryOutput], tags=["Categories"])
def categories(db: DB, offset: Offset = 0, limit: Limit = 100):
    return catalog.list_entities(db, Category, offset, limit)


@router.post("/categories", response_model=s.CategoryOutput, status_code=201, tags=["Categories"])
def create_category(data: s.CategoryInput, db: DB, user: Manager):
    return catalog.save(db, Category, data)


@router.get("/categories/{id}", response_model=s.CategoryOutput, tags=["Categories"])
def category(id: UUID, db: DB):
    return catalog.require(db, Category, id)


@router.put("/categories/{id}", response_model=s.CategoryOutput, tags=["Categories"])
def update_category(id: UUID, data: s.CategoryInput, db: DB, user: Manager):
    return catalog.save(db, Category, data, id)


@router.delete("/categories/{id}", status_code=204, tags=["Categories"])
def delete_category(id: UUID, db: DB, user: Manager):
    catalog.delete_category(db, id)
    return Response(status_code=204)


@router.get("/warehouses", response_model=list[s.WarehouseOutput], tags=["Warehouses"])
def warehouses(db: DB, offset: Offset = 0, limit: Limit = 100):
    return catalog.list_entities(db, Warehouse, offset, limit)


@router.post("/warehouses", response_model=s.WarehouseOutput, status_code=201, tags=["Warehouses"])
def create_warehouse(data: s.WarehouseInput, db: DB, user: Manager):
    return catalog.save(db, Warehouse, data)


@router.get("/warehouses/{id}", response_model=s.WarehouseOutput, tags=["Warehouses"])
def warehouse(id: UUID, db: DB):
    return catalog.require(db, Warehouse, id)


@router.put("/warehouses/{id}", response_model=s.WarehouseOutput, tags=["Warehouses"])
def update_warehouse(id: UUID, data: s.WarehouseInput, db: DB, user: Manager):
    return catalog.save(db, Warehouse, data, id)


@router.get("/locations", response_model=list[s.LocationOutput], tags=["Locations"])
def locations(db: DB, warehouse_id: UUID | None = None, offset: Offset = 0, limit: Limit = 100):
    query = select(Location)
    if warehouse_id:
        query = query.where(Location.warehouse_id == warehouse_id)
    return db.scalars(query.order_by(Location.id).offset(offset).limit(limit)).all()


@router.post("/locations", response_model=s.LocationOutput, status_code=201, tags=["Locations"])
def create_location(data: s.LocationInput, db: DB, user: Manager):
    return catalog.save(db, Location, data)


@router.get("/locations/{id}", response_model=s.LocationOutput, tags=["Locations"])
def location(id: UUID, db: DB):
    return catalog.require(db, Location, id)


@router.put("/locations/{id}", response_model=s.LocationOutput, tags=["Locations"])
def update_location(id: UUID, data: s.LocationInput, db: DB, user: Manager):
    return catalog.save(db, Location, data, id)


@router.get("/products", response_model=list[s.ProductOutput], tags=["Products"])
def products(
    db: DB,
    search: Annotated[str | None, Query(max_length=160)] = None,
    category_id: UUID | None = None,
    warehouse_id: UUID | None = None,
    location_id: UUID | None = None,
    offset: Offset = 0,
    limit: Limit = 100,
):
    return catalog.list_products(
        db,
        search=search,
        category_id=category_id,
        warehouse_id=warehouse_id,
        location_id=location_id,
        offset=offset,
        limit=limit,
    )


@router.post("/products", response_model=s.ProductOutput, status_code=201, tags=["Products"])
def create_product(data: s.ProductCreate, db: DB, user: Manager):
    return catalog.create_product(db, data, user.id)


@router.get("/products/{id}", response_model=s.ProductOutput, tags=["Products"])
def product(id: UUID, db: DB):
    return catalog.require(db, Product, id)


@router.put("/products/{id}", response_model=s.ProductOutput, tags=["Products"])
def update_product(id: UUID, data: s.ProductInput, db: DB, user: Manager):
    return catalog.update_product(db, id, data)


@router.get("/products/{id}/stock", response_model=list[s.StockOutput], tags=["Products"])
def product_stock(
    id: UUID,
    db: DB,
    warehouse_id: UUID | None = None,
    location_id: UUID | None = None,
    offset: Offset = 0,
    limit: Limit = 100,
):
    return catalog.stock_by_location(db, id, warehouse_id, location_id, offset, limit)


@router.get("/reorder-rules", response_model=list[s.ReorderOutput], tags=["Reordering rules"])
def reorder_rules(db: DB, product_id: UUID | None = None, offset: Offset = 0, limit: Limit = 100):
    query = select(ReorderRule)
    if product_id:
        query = query.where(ReorderRule.product_id == product_id)
    return db.scalars(query.order_by(ReorderRule.id).offset(offset).limit(limit)).all()


@router.post(
    "/reorder-rules", response_model=s.ReorderOutput, status_code=201, tags=["Reordering rules"]
)
def create_reorder_rule(data: s.ReorderInput, db: DB, user: Manager):
    return catalog.save(db, ReorderRule, data)


@router.put("/reorder-rules/{id}", response_model=s.ReorderOutput, tags=["Reordering rules"])
def update_reorder_rule(id: UUID, data: s.ReorderInput, db: DB, user: Manager):
    return catalog.save(db, ReorderRule, data, id)
