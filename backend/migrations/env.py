from alembic import context
from sqlalchemy import create_engine, pool

from app import models  # noqa: F401
from app.config import get_settings
from app.db import Base


def run_migrations():
    url = get_settings().database_url
    if context.is_offline_mode():
        context.configure(url=url, target_metadata=Base.metadata, literal_binds=True)
        with context.begin_transaction():
            context.run_migrations()
    else:
        supplied = context.config.attributes.get("connection")
        if supplied is not None:
            context.configure(connection=supplied, target_metadata=Base.metadata)
            with context.begin_transaction():
                context.run_migrations()
            return
        engine = create_engine(url, poolclass=pool.NullPool)
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=Base.metadata)
            with context.begin_transaction():
                context.run_migrations()
        engine.dispose()


run_migrations()
