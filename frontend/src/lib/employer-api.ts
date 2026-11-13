import { apiRequest } from "@/lib/task-api";

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

export function getEmployerTasks(): Promise<EmployerTaskApi[]> {
  return apiRequest<EmployerTaskApi[]>("/api/tasks/", {
    method: "GET",
  });
}

export function getEmployerBids(): Promise<EmployerBidListApi[]> {
  return apiRequest<EmployerBidListApi[]>("/api/offers/employer/bids/", {
    method: "GET",
  });
}

export function getTaskBids(taskId: string): Promise<EmployerBidListApi[]> {
  return apiRequest<EmployerBidListApi[]>(
    `/api/offers/employer/tasks/${taskId}/bids/`,
    { method: "GET" }
  );
}
