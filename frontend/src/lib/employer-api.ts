import { apiRequest, readAllPages } from "@/lib/task-api";

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

export function rejectEmployerBid(bidId: string): Promise<EmployerBidActionResponse> {
  return apiRequest<EmployerBidActionResponse>(
    `/api/offers/employer/bids/${encodeURIComponent(bidId)}/reject/`,
    { method: "POST" }
  );
}

export interface AssignmentPreview {
  task: Pick<EmployerTaskApi, "task_id" | "title" | "description" | "category_name" | "status" | "execution_window_start_at" | "execution_window_end_at" | "deadline_at" | "delivery_criteria" | "receipt_required"> & {currency_code: string; locations: {location_type: string; stop_order: number; city: string; region: string}[]};
  bid: Pick<EmployerBidListApi, "bid_id" | "status" | "proposed_wage_amount" | "proposed_duration_minutes" | "message" | "expires_at">;
  executor: AssignmentExecutor;
  reservation_preview: {labor_amount: number; expense_amount: number; reserved_amount: number; currency_code: string; platform_fee_rate_bps: number; platform_fee_amount: number; fee_payer: string; fee_included_in_reserved_amount: boolean};
  wallet: {currency_code: string; available_balance: number; reserved_balance: number; total_balance: number; required_reservation_amount: number; shortfall_amount: number; has_sufficient_balance: boolean; currency_matches: boolean; available_balance_after_reservation: number | null};
  can_confirm: boolean;
  blocking_reason: string | null;
}

export interface AssignmentExecutor {
  profile_id: string;
  full_name: string;
  avatar_type: string | null;
  avatar_id: string | null;
  avatar_url: string | null;
  bio: string | null;
  verification_status: string;
  completed_tasks_count: number;
  active_tasks_count: number;
  average_rating: number | null;
  rating_count: number | null;
}

export interface AssignmentResult {
  bid_id: string;
  task_id: string;
  status: string;
  task_status: string;
  escrow_reservation_id: string;
  escrow_public_reference: string;
  escrow_status: string;
  task_title: string;
  executor_name: string;
  reserved_amount: number;
  currency_code: string;
  available_balance_after_reservation: number;
}

export interface AssignedExecutor extends Omit<AssignmentExecutor, "profile_id"> {
  executor_profile_id: string; task_id: string; accepted_bid_id: string; task_status: string;
  phone: string | null; can_view_phone: boolean;
}
export interface ProgressReport {
  report_id: string; task_id: string; progress_percent: number; description: string; on_schedule: boolean; created_at: string;
}
export function getAssignedExecutor(taskId: string, signal?: AbortSignal) {
  return apiRequest<AssignedExecutor>(`/api/employer/tasks/${encodeURIComponent(taskId)}/executor/`, {signal});
}
export function getEmployerReports(taskId: string, signal?: AbortSignal) {
  return readAllPages<ProgressReport>(`/api/employer/tasks/${encodeURIComponent(taskId)}/progress-reports/`, signal);
}

export function getAssignmentPreview(bidId: string, signal?: AbortSignal): Promise<AssignmentPreview> {
  return apiRequest(`/api/offers/employer/bids/${encodeURIComponent(bidId)}/assignment-preview/`, {signal});
}

export function confirmAssignment(bidId: string, idempotencyKey: string): Promise<AssignmentResult> {
  return apiRequest(`/api/offers/employer/bids/${encodeURIComponent(bidId)}/accept/`, {
    method: "POST", headers: {"Idempotency-Key": idempotencyKey},
  });
}

export const assignmentPath = (taskId: string, bidId: string) => `/employer/tasks/${encodeURIComponent(taskId)}/assignment/${encodeURIComponent(bidId)}`;
export const trackingPath = (taskId: string) => `/employer/tasks/${encodeURIComponent(taskId)}/tracking`;
