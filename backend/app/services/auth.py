import hmac
import secrets
import time

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.errors import DomainError
from app.models import PasswordReset, User
from app.schemas import Signup
from app.security import DUMMY_HASH, access_token, password_hasher, secret_digest
from app import tasks

def signup(db: Session, data: Signup) -> User:
    user = User(
        **data.model_dump(exclude={"password"}),
        password_hash=password_hasher.hash(data.password),
        role="WAREHOUSE_STAFF",
    )
    db.add(user)
    db.flush()
    try:
        tasks.send_welcome_email_task.delay(user.email, user.name)
    except Exception:
        pass  # Don't fail signup if email task dispatch fails
    return user


def login(db: Session, login_id: str, password: str) -> dict:
    user = db.scalar(
        select(User)
        .where(or_(User.login_id == login_id.lower(), User.email == login_id.lower()))
        .with_for_update()
    )
    valid = password_hasher.verify(password, user.password_hash if user else DUMMY_HASH)
    now = int(time.time())
    if user and user.locked_until > now:
        raise DomainError(429, "LOGIN_THROTTLED", "Try again in 15 minutes")
    if not valid or not user:
        if user:
            if user.locked_until:
                user.failed_logins = 0
                user.locked_until = 0
            user.failed_logins += 1
            if user.failed_logins >= 5:
                user.locked_until = now + 900
            db.commit()  # Failed attempts must survive the rejected request.
        raise DomainError(401, "INVALID_CREDENTIALS", "Invalid login ID or password")
    user.failed_logins = 0
    user.locked_until = 0
    return access_token(user)


def forgot_password(db: Session, email: str):
    user = db.scalar(select(User).where(User.email == email).with_for_update())
    if not user:
        return
    now = int(time.time())
    challenge = db.get(PasswordReset, user.id)
    if challenge and now - challenge.issued_at < 60:
        return
    otp = f"{secrets.randbelow(1000000):06d}"
    if challenge is None:
        challenge = PasswordReset(user_id=user.id)
        db.add(challenge)
    challenge.otp_hash = secret_digest(f"{user.id}:{otp}")
    challenge.issued_at = now
    challenge.expires_at = now + 600
    challenge.attempts = 0
    challenge.reset_token_hash = None
    db.flush()
    tasks.send_reset_code_task.delay(email, otp)


def verify_otp(db: Session, email: str, otp: str) -> dict:
    user = db.scalar(select(User).where(User.email == email).with_for_update())
    challenge = db.get(PasswordReset, user.id) if user else None
    invalid = DomainError(400, "INVALID_OTP", "Invalid or expired reset code")
    if (
        not challenge
        or challenge.expires_at <= int(time.time())
        or challenge.attempts >= 5
        or challenge.reset_token_hash
    ):
        raise invalid
    challenge.attempts += 1
    if not hmac.compare_digest(challenge.otp_hash, secret_digest(f"{user.id}:{otp}")):
        db.commit()
        raise invalid
    token = secrets.token_urlsafe(32)
    challenge.reset_token_hash = secret_digest(token)
    challenge.expires_at = int(time.time()) + 600
    return {"reset_token": token, "expires_in": 600}


def reset_password(db: Session, token: str, password: str):
    # Always lock user before challenge, matching forgot/verify and preventing deadlocks.
    user_id = db.scalar(
        select(PasswordReset.user_id).where(PasswordReset.reset_token_hash == secret_digest(token))
    )
    user = db.scalar(select(User).where(User.id == user_id).with_for_update()) if user_id else None
    challenge = db.get(PasswordReset, user_id) if user else None
    if (
        not challenge
        or challenge.expires_at <= int(time.time())
        or not challenge.reset_token_hash
        or not hmac.compare_digest(challenge.reset_token_hash, secret_digest(token))
    ):
        raise DomainError(400, "INVALID_RESET_TOKEN", "Invalid or expired reset token")
    user.password_hash = password_hasher.hash(password)
    user.token_version += 1
    user.failed_logins = 0
    user.locked_until = 0
    db.delete(challenge)


def logout(db: Session, user: User):
    locked = db.scalar(select(User).where(User.id == user.id).with_for_update())
    db.refresh(locked)
    locked.token_version += 1
