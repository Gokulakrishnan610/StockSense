from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import DomainError
from app.models import User

DB = Annotated[Session, Depends(get_db, scope="function")]
bearer = HTTPBearer(auto_error=False)


def current_user(
    db: DB, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    error = DomainError(401, "UNAUTHORIZED", "A valid access token is required")
    if credentials is None:
        raise error
    try:
        payload = jwt.decode(
            credentials.credentials,
            get_settings().jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            audience="stocksense-api",
            issuer="stocksense",
            options={"require": ["sub", "ver", "exp", "iat", "jti", "type"]},
        )
        user = db.get(User, UUID(payload["sub"]))
        if not user or payload["type"] != "access" or payload["ver"] != user.token_version:
            raise error
        return user
    except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
        raise error from exc


CurrentUser = Annotated[User, Depends(current_user, scope="function")]


def manager(user: CurrentUser) -> User:
    if user.role != "INVENTORY_MANAGER":
        raise DomainError(403, "FORBIDDEN", "Inventory manager access is required")
    return user


Manager = Annotated[User, Depends(manager, scope="function")]
