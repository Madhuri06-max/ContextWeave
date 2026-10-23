
from pydantic import BaseModel, Field


class PlanRequest(BaseModel):
    request: str = Field(min_length=3, max_length=1000)


class ExecuteRequest(BaseModel):
    plan: dict
    approvals: dict[str, bool] = Field(default_factory=dict)
