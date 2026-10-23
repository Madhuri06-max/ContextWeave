
from app.database.connection import fetch_all, execute


def save_preference(key: str, value: str):
    execute(
        """
        INSERT INTO preferences (preference_key, preference_value)
        VALUES (?, ?)
        ON CONFLICT(preference_key)
        DO UPDATE SET preference_value = excluded.preference_value
        """,
        (key, value),
    )


def get_preferences():
    return fetch_all(
        "SELECT preference_key, preference_value FROM preferences ORDER BY preference_key"
    )
