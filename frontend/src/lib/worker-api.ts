import { apiRequest } from "@/lib/task-api";

export interface WorkerBidApi {
  bid_id: string;
  task_id: string;
  executor_profile_id: string;
  proposed_wage_amount: number;
  proposed_duration_minutes: number;
  message: string;
  expires_at: string | null;
  status: "ACTIVE" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
  created_at: string;
  updated_at: string;
}

export interface WorkerBidUpdate {
  proposed_wage_amount?: number;
  proposed_duration_minutes?: number;
  message?: string;
  expires_at?: string | null;
}

export interface DiscoverableTaskApi {
  task_id: string;
  category_id: string;
  category_name: string;
  title: string;
  description: string;
  status: string;
  estimated_duration_minutes: number;
  wage_budget_amount: number;
  currency_code: string;
  item_cost_cap_amount: number | null;
  receipt_required: boolean;
  execution_window_start_at: string;
  execution_window_end_at: string;
  deadline_at: string | null;
  proposal_deadline_at: string;
  delivery_criteria: string;
  published_at: string | null;
  created_at: string;
}

export function getMyBids(): Promise<WorkerBidApi[]> {
  return apiRequest<WorkerBidApi[]>("/api/offers/bids/", {
    method: "GET",
  });
}

export function getMyBid(bidId: string): Promise<WorkerBidApi> {
  return apiRequest<WorkerBidApi>(`/api/offers/bids/${bidId}/`, {
    method: "GET",
  });
}

export function updateMyBid(
  bidId: string,
  data: WorkerBidUpdate
): Promise<WorkerBidApi> {
  return apiRequest<WorkerBidApi>(`/api/offers/bids/${bidId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function getDiscoverableTask(
  taskId: string
): Promise<DiscoverableTaskApi> {
  return apiRequest<DiscoverableTaskApi>(
    `/api/discovery/tasks/${taskId}/`,
    { method: "GET" }
  );
}
