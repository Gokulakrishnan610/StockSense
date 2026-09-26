"""Local operator tool: python -m app.admin promote USER_EMAIL."""

import argparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_engine
from app.models import User


def main():
    parser = argparse.ArgumentParser(description="Provision an inventory manager")
    parser.add_argument("action", choices=["promote"])
    parser.add_argument("email")
    args = parser.parse_args()
    with Session(get_engine()) as db, db.begin():
        user = db.scalar(select(User).where(User.email == args.email.lower()).with_for_update())
        if not user:
            parser.error("Account not found; sign up first")
        user.role = "INVENTORY_MANAGER"
        user.token_version += 1
    print("Manager access granted. Log in again to obtain a new token.")


if __name__ == "__main__":
    main()
