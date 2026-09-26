import hashlib
import hmac
import time
import uuid

import jwt
from pwdlib import PasswordHash

from app.config import get_settings
from app.models import User

password_hasher = PasswordHash.recommended()
DUMMY_HASH = password_hasher.hash("unusable-dummy-password")


def secret_digest(value: str) -> str:
    return hmac.new(
        get_settings().jwt_secret.get_secret_value().encode(), value.encode(), hashlib.sha256
    ).hexdigest()


def access_token(user: User) -> dict:
    settings = get_settings()
    now = int(time.time())
    lifetime = settings.access_token_minutes * 60
    encoded = jwt.encode(
        {
            "sub": str(user.id),
            "ver": user.token_version,
            "iat": now,
            "exp": now + lifetime,
            "iss": "stocksense",
            "aud": "stocksense-api",
            "jti": str(uuid.uuid4()),
            "type": "access",
        },
        settings.jwt_secret.get_secret_value(),
        algorithm="HS256",
    )
    return {"access_token": encoded, "expires_in": lifetime}
