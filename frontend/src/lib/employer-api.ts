import { apiRequest } from "@/lib/task-api";

/** Task representation returned by GET /api/tasks/. */
export interface EmployerTaskApi {
  task_id: string;
  employer_user_id: string;
  category_id: string;
  category_name: string;
  title: string;
  description: string;
  status: string;
  estimated_duration_minutes: number;
  wage_budget_amount: number;
  currency_code?: string;
  item_cost_cap_amount?: number | null;
  receipt_required?: boolean;
  execution_window_start_at: string;
  execution_window_end_at: string;
  deadline_at?: string | null;
  proposal_deadline_at: string;
  delivery_criteria: string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployerBidListApi {
  bid_id: string;
  task_id: string;
  task_title: string;
  task_currency_code: string;
  executor_profile_id: string;
  executor_name: string;
  executor_bio: string | null;
  executor_verification_status: string;
  proposed_wage_amount: number;
  proposed_duration_minutes: number;
  message: string;
  expires_at: string | null;
  status: "ACTIVE" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
  created_at: string;
}

/** Fields accepted by PatchedTaskUpdateRequest in the OpenAPI spec. */
export type EmployerTaskUpdate = Partial<Pick<
  EmployerTaskApi,
  | "category_id"
  | "title"
  | "description"
  | "estimated_duration_minutes"
  | "wage_budget_amount"
  | "item_cost_cap_amount"
  | "receipt_required"
  | "execution_window_start_at"
  | "execution_window_end_at"
  | "deadline_at"
  | "proposal_deadline_at"
  | "delivery_criteria"
>>;

export interface EmployerBidActionResponse {
  bid_id?: string;
  status?: string;
  detail?: string;
}

export interface EmployerTaskCancelResponse {
  task_id?: string;
  status?: string;
  detail?: string;
}

export function getEmployerTasks(): Promise<EmployerTaskApi[]> {
  return apiRequest<EmployerTaskApi[]>("/api/tasks/");
}

export function updateEmployerTask(
  taskId: string,
  payload: EmployerTaskUpdate
): Promise<EmployerTaskApi> {
  return apiRequest<EmployerTaskApi>(`/api/tasks/${encodeURIComponent(taskId)}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function cancelEmployerTask(taskId: string): Promise<EmployerTaskCancelResponse> {
  return apiRequest<EmployerTaskCancelResponse>(
    `/api/tasks/${encodeURIComponent(taskId)}/cancel/`,
    { method: "POST" }
  );
}

export function publishEmployerTask(taskId: string): Promise<EmployerTaskApi> {
  return apiRequest<EmployerTaskApi>(
    `/api/tasks/${encodeURIComponent(taskId)}/publish/`,
    { method: "POST" }
  );
}

export function getEmployerBids(): Promise<EmployerBidListApi[]> {
  return apiRequest<EmployerBidListApi[]>("/api/offers/employer/bids/");
}

export function getTaskBids(taskId: string): Promise<EmployerBidListApi[]> {
  return apiRequest<EmployerBidListApi[]>(
    `/api/offers/employer/tasks/${encodeURIComponent(taskId)}/bids/`
  );
}

export function acceptEmployerBid(bidId: string): Promise<EmployerBidActionResponse> {
  return apiRequest<EmployerBidActionResponse>(
    `/api/offers/employer/bids/${encodeURIComponent(bidId)}/accept/`,
    { method: "POST" }
  );
}

export function rejectEmployerBid(bidId: string): Promise<EmployerBidActionResponse> {
  return apiRequest<EmployerBidActionResponse>(
    `/api/offers/employer/bids/${encodeURIComponent(bidId)}/reject/`,
    { method: "POST" }
  );
}
