import { apiRequest } from "./task-api";

interface ExecutorTaskCard {
  task_id: string; title: string; description: string; category_name: string;
  status: string; agreed_wage_amount: number; currency_code: string;
  proposed_duration_minutes: number; started_at: string | null; due_at: string | null;
  remaining_seconds: number | null; server_time: string; progress_percent: number;
  escrow_verified: boolean; can_start: boolean; can_report_progress: boolean;
  can_view_private_details: boolean;
}

interface ExecutorTaskDetail extends ExecutorTaskCard {
  delivery_criteria: string;
  employer: { user_id: string; full_name: string; avatar_url: string | null; completed_tasks_count: number; average_rating: number | null };
  locations: { city: string; region: string }[];
}

interface PrivateDetails {
  task_id: string; employer_phone: string;
  locations: { city: string; region: string; latitude: number | null; longitude: number | null; exact_address: string | null }[];
}

interface TaskListResponse { results: ExecutorTaskCard[]; next: string | null }
interface StartResponse { task_id: string; status: string; version: number }

export interface AssignedTask {
  task_id: string; title: string; description: string; delivery_criteria: string;
  category: string; status: string; wage: number; currency: string;
  duration_minutes: number; deadline_at: string | null; started_at: string | null;
  remaining_seconds: number | null; server_time: string; progress_percent: number;
  can_start: boolean; can_report_progress: boolean; can_view_private_details: boolean;
  employer_name: string; employer_phone: string | null;
  employer_avatar_url?: string | null; employer_verified?: boolean;
  employer_rating?: number | null; employer_completed_tasks?: number | null;
  employer_profile_url?: string | null; conversation_url?: string | null;
  escrow_status?: "FUNDED" | "PENDING" | null;
  locations: { city: string; region: string; latitude?: number | null; longitude?: number | null; address?: string | null }[];
}

function mapTask(task: ExecutorTaskCard, detail?: ExecutorTaskDetail): AssignedTask {
  return {
    task_id: task.task_id, title: task.title, description: task.description,
    delivery_criteria: detail?.delivery_criteria ?? "", category: task.category_name,
    status: task.status, wage: task.agreed_wage_amount, currency: task.currency_code,
    duration_minutes: task.proposed_duration_minutes, deadline_at: task.due_at,
    started_at: task.started_at, remaining_seconds: task.remaining_seconds,
    server_time: task.server_time, progress_percent: task.progress_percent,
    can_start: task.can_start, can_report_progress: task.can_report_progress,
    can_view_private_details: task.can_view_private_details,
    employer_name: detail?.employer.full_name ?? "", employer_phone: null,
    employer_avatar_url: detail?.employer.avatar_url, employer_rating: detail?.employer.average_rating,
    employer_completed_tasks: detail?.employer.completed_tasks_count,
    escrow_status: task.escrow_verified ? "FUNDED" : null,
    locations: detail?.locations ?? [],
  };
}

const listPath = "/api/executor/tasks/";
const taskPath = (id: string) => `${listPath}${encodeURIComponent(id)}/`;

export async function getAssignedTasks(): Promise<AssignedTask[]> {
  const tasks: AssignedTask[] = [];
  const visited = new Set<string>();
  let path: string | null = listPath;
  while (path) {
    if (visited.size >= 1000) throw new Error("تعداد صفحات تسک‌ها بیش از حد مجاز است.");
    if (visited.has(path)) throw new Error("صفحه‌بندی تسک‌ها نامعتبر است.");
    visited.add(path);
    const page: TaskListResponse = await apiRequest<TaskListResponse>(path);
    if (!Array.isArray(page.results)) throw new Error("پاسخ فهرست تسک‌ها معتبر نیست.");
    tasks.push(...page.results.filter(task => task.status === "ASSIGNED" || task.status === "IN_PROGRESS").map(task => mapTask(task)));
    if (!page.next) break;
    const next = new URL(page.next, `http://localhost${listPath}`);
    if (next.pathname !== listPath) throw new Error("مسیر صفحه بعدی تسک‌ها معتبر نیست.");
    path = `${listPath}${next.search}`;
  }
  return tasks;
}

export async function getAssignedTask(id: string): Promise<AssignedTask> {
  const detail = await apiRequest<ExecutorTaskDetail>(taskPath(id));
  return mapTask(detail, detail);
}

export async function getPrivateDetails(id: string): Promise<PrivateDetails> {
  return apiRequest<PrivateDetails>(`${taskPath(id)}private-details/`);
}

export function addPrivateDetails(task: AssignedTask, details: PrivateDetails): AssignedTask {
  if (details.task_id !== task.task_id) throw new Error("اطلاعات محرمانه با تسک مطابقت ندارد.");
  return { ...task, employer_phone: details.employer_phone, locations: details.locations.map(location => ({ ...location, address: location.exact_address })) };
}

export async function startTask(id: string): Promise<StartResponse> {
  return apiRequest<StartResponse>(`/api/tasks/${encodeURIComponent(id)}/start/`, { method: "POST" });
}

export function reportProgress(id: string, percent: number, description: string, on_schedule: boolean): Promise<unknown> {
  if (![25, 50, 75, 100].includes(percent) || !description.trim() || description.trim().length > 4000) {
    throw new Error("درصد و توضیحات گزارش را بررسی کنید.");
  }
  return apiRequest(`${taskPath(id)}progress-reports/`, { method: "POST", body: JSON.stringify({ progress_percent: percent, description: description.trim(), on_schedule }) });
}
