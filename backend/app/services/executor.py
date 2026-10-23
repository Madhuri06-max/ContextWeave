
from app.database.connection import fetch_all, fetch_one, execute
from app.services.action_history import record_action
from app.services.permissions import check_approval


def normalize_reminder(text: str) -> str:
    return " ".join(text.casefold().split())


def get_reminder_time(description: str):
    """
    Parse basic reminder dates and times.
    This prototype saves reminders but does not send notifications.
    """
    import re
    from datetime import datetime, timedelta

    text = description.casefold()

    time_match = re.search(
        r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b"
        r"|\b([01]?\d|2[0-3]):([0-5]\d)\b",
        text,
    )

    if time_match:
        if time_match.group(4) is not None:
            hour = int(time_match.group(4))
            minute = int(time_match.group(5))
        else:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2) or 0)
            meridiem = time_match.group(3)

            if meridiem == "pm" and hour != 12:
                hour += 12
            elif meridiem == "am" and hour == 12:
                hour = 0

        now = datetime.now()
        scheduled = now.replace(
            hour=hour,
            minute=minute,
            second=0,
            microsecond=0,
        )

        if "tomorrow" in text:
            scheduled += timedelta(days=1)
        elif "today" not in text and scheduled < now:
            scheduled += timedelta(days=1)

        return scheduled.isoformat(timespec="minutes")

    if "tomorrow" in text:
        return (datetime.now() + timedelta(days=1)).date().isoformat()

    if "today" in text:
        return datetime.now().date().isoformat()

    return None


def execute_action(action: dict, approved: bool = False):
    action_id = action["id"]
    action_type = action["type"]
    description = action["description"]

    # Do not execute the same successfully processed action ID twice.
    existing = fetch_one(
        "SELECT * FROM action_history WHERE action_key = ?",
        (action_id,),
    )

    if existing and existing["status"] in {
        "completed",
        "approval_recorded",
    }:
        return {
            "id": action_id,
            "status": existing["status"],
            "result": existing["result"],
            "already_processed": True,
        }

    # Sensitive actions must pass the approval check.
    if not check_approval(action_type, approved):
        result = "User approval is required."

        record_action(
            action_id,
            action_type,
            description,
            "awaiting_approval",
            result,
        )

        return {
            "id": action_id,
            "status": "awaiting_approval",
            "result": (
                "Approval is required before this sensitive "
                "action can proceed."
            ),
        }

    if action_type == "task":
        existing_task = fetch_one(
            """
            SELECT id, title
            FROM tasks
            WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))
            ORDER BY id DESC
            LIMIT 1
            """,
            (description,),
        )

        if existing_task and not action.get("allow_duplicate", False):
            result = (
                f"Duplicate task found: '{existing_task['title']}' "
                f"(Task #{existing_task['id']}). "
                "Confirmation is required to create another copy."
            )

            record_action(
                action_id,
                action_type,
                description,
                "duplicate_warning",
                result,
            )

            return {
                "id": action_id,
                "status": "duplicate_warning",
                "result": result,
                "existing_task_id": existing_task["id"],
            }

        execute(
            "INSERT INTO tasks (title) VALUES (?)",
            (description,),
        )

        result = "Task saved successfully."
        status = "completed"

    elif action_type == "reminder":
        normalized_description = normalize_reminder(description)

        reminders = fetch_all(
            "SELECT id, title, reminder_time FROM reminders"
        )

        duplicate = next(
            (
                reminder
                for reminder in reminders
                if normalize_reminder(reminder["title"])
                == normalized_description
            ),
            None,
        )

        if duplicate:
            result = (
                "This reminder already exists. "
                f"Existing reminder ID: {duplicate['id']}. "
                "No duplicate was created."
            )
            status = "completed"

        else:
            reminder_time = get_reminder_time(description)

            execute(
                """
                INSERT INTO reminders (title, reminder_time)
                VALUES (?, ?)
                """,
                (description, reminder_time),
            )

            if reminder_time:
                result = (
                    f"Reminder saved for {reminder_time}. "
                    "This demo does not send a notification yet."
                )
            else:
                result = (
                    "Reminder saved without a scheduled time. "
                    "Include a supported time such as '6 PM', "
                    "'18:30', 'today', or 'tomorrow'."
                )

            status = "completed"

    elif action_type == "message":
        result = (
            "Approval recorded. No message was sent; "
            "connect a messaging provider to enable delivery."
        )
        status = "approval_recorded"

    else:
        result = "Action type is not supported."
        status = "unsupported"

    record_action(
        action_id,
        action_type,
        description,
        status,
        result,
    )

    return {
        "id": action_id,
        "status": status,
        "result": result,
    }


def get_state():
    return {
        "tasks": fetch_all(
            "SELECT * FROM tasks ORDER BY id DESC LIMIT 50"
        ),
        "reminders": fetch_all(
            "SELECT * FROM reminders ORDER BY id DESC LIMIT 50"
        ),
    }
