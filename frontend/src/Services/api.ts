import type {
  AppState,
  ExecutionResult,
  HistoryItem,
  Plan,
} from "../types";

const API_BASE = "http://127.0.0.1:8000";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function createPlan(requestText: string): Promise<Plan> {
  return request<Plan>("/plan", {
    method: "POST",
    body: JSON.stringify({ request: requestText }),
  });
}

export function executePlan(
  plan: Plan,
  approvals: Record<string, boolean>,
): Promise<{ results: ExecutionResult[] }> {
  return request<{ results: ExecutionResult[] }>("/execute", {
    method: "POST",
    body: JSON.stringify({ plan, approvals }),
  });
}

export function fetchState(): Promise<AppState> {
  return request<AppState>("/state");
}

export function fetchHistory(): Promise<HistoryItem[]> {
  return request<HistoryItem[]>("/history");
}