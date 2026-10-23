
import sqlite3
from contextlib import contextmanager

from app.core.config import DATABASE_PATH


@contextmanager
def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def fetch_all(query: str, params: tuple = ()):
    with get_connection() as connection:
        rows = connection.execute(query, params).fetchall()
        return [dict(row) for row in rows]


def fetch_one(query: str, params: tuple = ()):
    with get_connection() as connection:
        row = connection.execute(query, params).fetchone()
        return dict(row) if row else None


def execute(query: str, params: tuple = ()):
    with get_connection() as connection:
        cursor = connection.execute(query, params)
        return cursor.lastrowid
