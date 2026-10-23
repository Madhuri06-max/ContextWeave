
from app.database.connection import fetch_all, execute


def record_action(action_key, action_type, description, status, result):
    execute(
        """
        INSERT INTO action_history
        (action_key, action_type, description, status, result)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(action_key) DO UPDATE SET
            status = excluded.status,
            result = excluded.result
        """,
        (action_key, action_type, description, status, result),
    )


def get_history():
    return fetch_all(
        "SELECT * FROM action_history ORDER BY id DESC LIMIT 50"
    )
