import { getAccessToken } from "./auth-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
  ?.trim()
  .replace(/\/+$/, "");

export interface TaskCategory {
  category_id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  parent_category_name: string | null;
}

export interface TaskLocationInput {
  location_type: string;
  stop_order: number;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
}

export interface TaskCreatePayload {
  category_id: string;
  title: string;
  description: string;
  estimated_duration_minutes: number;
  wage_budget_amount: number;
  item_cost_cap_amount?: number | null;
  receipt_required: boolean;
  execution_window_start_at: string;
  execution_window_end_at: string;
  deadline_at?: string | null;
  proposal_deadline_at: string;
  delivery_criteria: string;
  locations?: TaskLocationInput[];
}

export interface CreatedTask {
  task_id: string;
  title: string;
  status: string;
  category_id: string;
  created_at: string;
}

function getApiUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error(
      "آدرس سرور مشخص نشده است. NEXT_PUBLIC_API_BASE_URL را در .env.local تنظیم کنید."
    );
  }

  return `${API_BASE_URL}${path}`;
}

function getErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;

    if (typeof data.detail === "string") {
      return data.detail;
    }

    const messages = Object.entries(data)
      .flatMap(([key, value]) => {
        const values = Array.isArray(value) ? value : [value];

        return values
          .filter((item): item is string => typeof item === "string")
          .map((item) => `${key}: ${item}`);
      });

    if (messages.length) return messages.join(" ");
  }

  if (status === 401) {
    return "نشست شما منقضی شده است. لطفاً دوباره وارد حساب شوید.";
  }

  if (status === 403) {
    return "اجازه ایجاد تسک را ندارید.";
  }

  if (status === 404) {
    return "مسیر API پیدا نشد. آدرس Backend را بررسی کنید.";
  }

  if (status === 400) {
    return "اطلاعات ارسالی معتبر نیست. لطفاً اطلاعات فرم را بررسی کنید.";
  }

  if (status >= 500) {
    return "خطایی در سرور رخ داده است. لطفاً دوباره تلاش کنید.";
  }

  return "ثبت درخواست با خطا مواجه شد.";
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();

  if (!token && options.method !== "GET") {
    throw new Error("برای ایجاد تسک ابتدا باید وارد حساب کاربری شوید.");
  }

  let response: Response;

  try {
    response = await fetch(getApiUrl(path), {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "ارتباط با سرور برقرار نشد. اتصال اینترنت و آدرس API را بررسی کنید.",
    );
  }

  const responseText = await response.text();

  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, response.status));
  }

  return payload as T;
}

/** دریافت دسته‌بندی‌های فعال */
export function getTaskCategories(): Promise<TaskCategory[]> {
  return apiRequest<TaskCategory[]>("/api/task-categories/", {
    method: "GET",
  });
}

export function createTask(payload: TaskCreatePayload): Promise<CreatedTask> {
  return apiRequest<CreatedTask>("/api/tasks/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}