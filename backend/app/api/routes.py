
from fastapi import APIRouter, HTTPException

from app.api.schemas import PlanRequest, ExecuteRequest
from app.planner.planner import create_plan
from app.services.executor import execute_action, get_state
from app.services.action_history import get_history
from app.services.memory import get_preferences, save_preference

router = APIRouter()


@router.post("/plan")
def plan_request(payload: PlanRequest):
    return create_plan(payload.request)


@router.post("/execute")
def execute_plan(payload: ExecuteRequest):
    actions = payload.plan.get("actions")

    if not isinstance(actions, list):
        raise HTTPException(
            status_code=400,
            detail="Plan has no valid actions.",
        )

    results = []

    for action in actions:
        if not isinstance(action, dict):
            raise HTTPException(
                status_code=400,
                detail="Invalid action in plan.",
            )

        action_id = action.get("id")
        action_type = action.get("type")
        description = action.get("description")

        if not action_id or not action_type or not description:
            raise HTTPException(
                status_code=400,
                detail="Invalid action in plan.",
            )

        approved = payload.approvals.get(action_id, False)

        results.append(execute_action(action, approved))

    return {"results": results}


@router.get("/state")
def read_state():
    return get_state()


@router.get("/history")
def read_history():
    return get_history()


@router.get("/preferences")
def read_preferences():
    return get_preferences()


@router.post("/preferences")
def write_preference(payload: dict):
    key = str(payload.get("key", "")).strip()
    value = str(payload.get("value", "")).strip()

    if not key or not value:
        raise HTTPException(
            status_code=400,
            detail="Both key and value are required.",
        )

    save_preference(key, value)

    return {
        "status": "saved",
        "key": key,
        "value": value,
    }
