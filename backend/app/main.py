from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.errors import DomainError
from app.op_routes import op_router
from app.routes import auth_router, router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="StockSense Core API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def prevent_auth_caching(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/auth/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
        return response

    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status == 401 else {}
        return JSONResponse(
            status_code=exc.status,
            headers=headers,
            content={"code": exc.code, "message": exc.message},
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error(request: Request, exc: IntegrityError):
        # SQL parameters can contain password hashes and must not reach clients.
        return JSONResponse(
            status_code=409,
            content={
                "code": "DATA_CONFLICT",
                "message": "Duplicate value or record still referenced",
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "code": "VALIDATION_ERROR",
                "message": "Invalid request",
                "errors": [
                    {"field": ".".join(map(str, e["loc"])), "message": e["msg"]}
                    for e in exc.errors()
                ],
            },
        )

    @app.get("/health", tags=["Health"])
    def health():
        return {"status": "ok"}

    app.include_router(auth_router)
    app.include_router(router)
    app.include_router(op_router)
    return app


app = create_app()
