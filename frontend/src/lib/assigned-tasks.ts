import { apiRequest } from "./task-api";

export interface AssignedTask {
  task_id: string; title: string; description: string; delivery_criteria: string;
  category: string; status: "ASSIGNED" | "IN_PROGRESS"; wage: number; currency: string;
  duration_minutes: number; deadline_at: string | null; started_at: string | null;
  employer_name: string; employer_phone: string | null;
  employer_avatar_url?: string | null; employer_verified?: boolean;
  employer_rating?: number | null; employer_completed_tasks?: number | null;
  employer_profile_url?: string | null; conversation_url?: string | null;
  escrow_status?: "FUNDED" | "PENDING" | null;
  locations: { city: string; region: string; latitude?: number | null; longitude?: number | null; address?: string | null }[];
}
export const getAssignedTasks = () => apiRequest<AssignedTask[]>("/api/worker/tasks/");
export const getAssignedTask = (id: string) => apiRequest<AssignedTask>(`/api/worker/tasks/${id}/`);
export const startTask = (id: string) => apiRequest<AssignedTask>(`/api/worker/tasks/${id}/start/`, { method: "POST" });
export const reportProgress = (id: string, percent: number, description: string, on_schedule: boolean) => apiRequest(`/api/worker/tasks/${id}/progress/`, { method: "POST", body: JSON.stringify({ percent, description, on_schedule }) });
