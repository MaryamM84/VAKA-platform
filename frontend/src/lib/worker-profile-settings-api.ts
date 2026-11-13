import { getAccessToken } from "./auth-api";

export interface TaskCategoryRecord {
  category_id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  parent_category_name: string | null;
}

export interface WorkerPreferencesRecord {
  work_interests: string[];
  preferred_categories: Array<{
    category_id: string;
    name: string;
    description: string | null;
  }>;
}

export interface WorkerServiceAreaRecord {
  service_area_city: string;
  service_area_region: string;
  service_area_latitude: string | number | null;
  service_area_longitude: string | number | null;
  service_area_radius_km: number | null;
}

export interface WorkerServiceAreaPayload {
  service_area_city?: string;
  service_area_region?: string;
  service_area_latitude?: number | null;
  service_area_longitude?: number | null;
  service_area_radius_km?: number | null;
}

export interface WorkerAvailabilitySlotRecord {
  availability_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerAvailabilityCollection {
  availability_timezone: string;
  slots: WorkerAvailabilitySlotRecord[];
}

export interface WorkerAvailabilityPayload {
  weekday: number;
  start_time: string;
  end_time: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

function getApiUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error(
      "آدرس سرور مشخص نشده است. مقدار NEXT_PUBLIC_API_BASE_URL را در frontend/.env.local تنظیم کنید.",
    );
  }
  return `${API_BASE_URL}${path}`;
}

function getApiErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const data = payload as Record<string, unknown>;
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;

    const messages = Object.entries(data).flatMap(([field, value]) => {
      const values = Array.isArray(value) ? value : [value];
      return values
        .filter((item): item is string => typeof item === "string")
        .map((item) => `${field}: ${item}`);
    });
    if (messages.length) return messages.join(" ");
  }

  switch (status) {
    case 400:
      return "اطلاعات واردشده معتبر نیست. مقادیر و بازه‌های زمانی را بررسی کنید.";
    case 401:
      return "نشست شما معتبر نیست؛ لطفاً دوباره وارد حساب کاربری شوید.";
    case 403:
      return "اجازه انجام این عملیات را ندارید.";
    case 404:
      return "مسیر API پیدا نشد؛ نسخه Backend را بررسی کنید.";
    case 409:
      return "این تغییر با وضعیت فعلی اطلاعات سازگار نیست.";
    case 429:
      return "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.";
    default:
      return status >= 500
        ? "در سرور مشکلی پیش آمده است. کمی بعد دوباره تلاش کنید."
        : "ارتباط با API با خطا مواجه شد.";
  }
}

async function apiRequest<T>(
  path: string,
  method: ApiMethod,
  body?: unknown,
  requiresAuth = true,
): Promise<T> {
  const token = getAccessToken();
  if (requiresAuth && !token) {
    throw new Error("برای مشاهده یا تغییر تنظیمات ابتدا وارد حساب کاربری شوید.");
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  };

  let response: Response;
  try {
    response = await fetch(getApiUrl(path), {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
  } catch {
    throw new Error("ارتباط با سرور برقرار نشد. اتصال و آدرس API را بررسی کنید.");
  }

  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) throw new Error(getApiErrorMessage(payload, response.status));
  if (response.status === 204) return undefined as T;
  return payload as T;
}

export function getTaskCategories(): Promise<TaskCategoryRecord[]> {
  return apiRequest<TaskCategoryRecord[]>("/api/task-categories/", "GET", undefined, false);
}

export function getMyWorkerPreferences(): Promise<WorkerPreferencesRecord> {
  return apiRequest<WorkerPreferencesRecord>("/api/profile/me/preferences/", "GET");
}

export function updateMyWorkerPreferences(payload: { preferred_category_ids: string[] }): Promise<WorkerPreferencesRecord> {
  return apiRequest<WorkerPreferencesRecord>("/api/profile/me/preferences/", "PATCH", payload);
}

export function getMyServiceArea(): Promise<WorkerServiceAreaRecord> {
  return apiRequest<WorkerServiceAreaRecord>("/api/profile/me/service-area/", "GET");
}

export function updateMyServiceArea(payload: WorkerServiceAreaPayload): Promise<WorkerServiceAreaRecord> {
  return apiRequest<WorkerServiceAreaRecord>("/api/profile/me/service-area/", "PATCH", payload);
}

export function getMyAvailability(): Promise<WorkerAvailabilityCollection> {
  return apiRequest<WorkerAvailabilityCollection>("/api/profile/me/availability/", "GET");
}

export function createMyAvailabilitySlot(payload: WorkerAvailabilityPayload): Promise<WorkerAvailabilitySlotRecord> {
  return apiRequest<WorkerAvailabilitySlotRecord>("/api/profile/me/availability/", "POST", payload);
}

export function updateMyAvailabilitySlot(
  availabilityId: string,
  payload: Partial<WorkerAvailabilityPayload>,
): Promise<WorkerAvailabilitySlotRecord> {
  return apiRequest<WorkerAvailabilitySlotRecord>(
    `/api/profile/me/availability/${encodeURIComponent(availabilityId)}/`,
    "PATCH",
    payload,
  );
}

export function deleteMyAvailabilitySlot(availabilityId: string): Promise<void> {
  return apiRequest<void>(
    `/api/profile/me/availability/${encodeURIComponent(availabilityId)}/`,
    "DELETE",
  );
}
