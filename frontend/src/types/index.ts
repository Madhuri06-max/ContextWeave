
export type ActionStatus =
  | "planned"
  | "awaiting_approval"
  | "completed"
  | "approval_recorded";

export interface PlannedAction {
  id: string;
  step: number;
  type: "task" | "reminder" | "message";
  description: string;
  requires_approval: boolean;
  status: ActionStatus;
}

export interface Plan {
  plan_id: string;
  request: string;
  status: string;
  actions: PlannedAction[];
}

export interface ExecutionResult {
  id: string;
  status: string;
  result: string;
}

export interface Task {
  id: number;
  title: string;
  status: string;
  created_at: string;
}

export interface Reminder {
  id: number;
  title: string;
  reminder_time: string | null;
  status: string;
  created_at: string;
}

export interface AppState {
  tasks: Task[];
  reminders: Reminder[];
}

export interface HistoryItem {
  id: number;
  action_key: string;
  action_type: string;
  description: string;
  status: string;
  result: string;
  created_at: string;
}
