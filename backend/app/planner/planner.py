
import re
import uuid

from app.services.permissions import requires_approval


def split_request(text: str):
    cleaned = re.sub(
        r"\b(and then|then|after that|also|plus)\b",
        "|",
        text,
        flags=re.IGNORECASE,
    )
    parts = [part.strip(" .,!?") for part in cleaned.split("|")]
    return [part for part in parts if part]


def classify_action(text: str):
    lower = text.lower()

    if any(word in lower for word in [
        "message", "text my", "send an email", "email my",
        "notify", "tell my"
    ]):
        return "message"

    if any(word in lower for word in [
        "remind", "reminder", "appointment", "meeting"
    ]):
        return "reminder"

    return "task"


def create_plan(request_text: str):
    parts = split_request(request_text)
    actions = []

    for index, part in enumerate(parts, start=1):
        action_type = classify_action(part)
        actions.append({
            "id": str(uuid.uuid4()),
            "step": index,
            "type": action_type,
            "description": part,
            "requires_approval": requires_approval(action_type),
            "status": (
                "awaiting_approval"
                if requires_approval(action_type)
                else "planned"
            ),
        })

    return {
        "plan_id": str(uuid.uuid4()),
        "request": request_text,
        "status": "awaiting_approval" if any(
            action["requires_approval"] for action in actions
        ) else "ready",
        "actions": actions,
    }
