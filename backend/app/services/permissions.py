
SENSITIVE_ACTIONS = {"message", "send_message", "email", "payment"}


def requires_approval(action_type: str) -> bool:
    return action_type.lower() in SENSITIVE_ACTIONS


def check_approval(action_type: str, approved: bool) -> bool:
    if requires_approval(action_type):
        return approved
    return True
