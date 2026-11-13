
import {
  getAccessToken,
  refreshAccessToken,
  type AuthResponse,
  type TokenRefreshResponse,
} from "./auth-api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
  ?.trim()
  .replace(/\/+$/, "");

const AUTH_STORAGE_KEY = "vaka.auth";

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
    return "اجازه انجام این درخواست را ندارید.";
  }

  if (status === 404) {
    return "مسیر API پیدا نشد. آدرس Backend را بررسی کنید.";
  }

  if (status === 400) {
    return "اطلاعات ارسالی معتبر نیست. لطفاً فرم را بررسی کنید.";
  }

  if (status >= 500) {
    return "در سرور مشکلی پیش آمده است. لطفاً دوباره تلاش کنید.";
  }

  return "انجام درخواست با خطا مواجه شد.";
}

function getStoredAuth(): AuthResponse | null {
  if (typeof window === "undefined") return null;

  try {
    const raw =
      localStorage.getItem(AUTH_STORAGE_KEY) ??
      sessionStorage.getItem(AUTH_STORAGE_KEY);

    if (!raw) return null;

    const auth = JSON.parse(raw) as Partial<AuthResponse>;

    if (
      typeof auth.access !== "string" ||
      typeof auth.refresh !== "string" ||
      !auth.user
    ) {
      return null;
    }

    return auth as AuthResponse;
  } catch {
    return null;
  }
}

function saveRefreshedTokens(
  tokens: TokenRefreshResponse,
  previousAuth: AuthResponse
): void {
  if (typeof window === "undefined") return;

  const updatedAuth: AuthResponse = {
    ...previousAuth,
    access: tokens.access,
    refresh: tokens.refresh ?? previousAuth.refresh,
  };

  const storage = localStorage.getItem(AUTH_STORAGE_KEY)
    ? localStorage
    : sessionStorage;

  storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedAuth));
}

async function parseResponse(response: Response): Promise<unknown> {
  const responseText = await response.text();

  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

let refreshPromise: Promise<string> | null = null;

async function getValidAccessToken(): Promise<string | null> {
  const auth = getStoredAuth();

  if (!auth) {
    return getAccessToken();
  }

  if (!auth.refresh) {
    return auth.access || null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const tokens = await refreshAccessToken(auth.refresh);

      if (!tokens.access) {
        throw new Error("سرور توکن دسترسی جدیدی برنگرداند.");
      }

      saveRefreshedTokens(tokens, auth);

      return tokens.access;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function sendRequest(
  path: string,
  options: RequestInit,
  token: string | null
): Promise<Response> {
  return fetch(getApiUrl(path), {
    ...options,
    headers: {
      Accept: "application/json",
      ...(typeof FormData !== "undefined" && options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  const token = getAccessToken();

  if (!token && method !== "GET") {
    throw new Error("برای انجام این عملیات ابتدا وارد حساب کاربری شوید.");
  }

  let response: Response;

  try {
    response = await sendRequest(path, options, token);

    // Only retry once after refreshing an expired access token.
    if (response.status === 401 && getStoredAuth()?.refresh) {
      const newToken = await getValidAccessToken();

      if (newToken) {
        response = await sendRequest(path, options, newToken);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "ارتباط با سرور برقرار نشد. اتصال اینترنت و آدرس API را بررسی کنید."
    );
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiRequestError(getErrorMessage(payload, response.status), response.status);
  }

  return payload as T;
}

/** دریافت دسته‌بندی‌های فعال */
export function getTaskCategories(): Promise<TaskCategory[]> {
  return apiRequest<TaskCategory[]>("/api/task-categories/", {
    method: "GET",
  });
}

export function createTask(
  payload: TaskCreatePayload
): Promise<CreatedTask> {
  return apiRequest<CreatedTask>("/api/tasks/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
