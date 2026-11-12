import { getAccessToken } from "./auth-api";

export type WorkerSkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export interface SkillCatalogItem {
  skill_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
}

export interface WorkerSkillRecord {
  worker_skill_id: string;
  skill: {
    skill_id: string;
    name: string;
    description: string | null;
    category: {
      category_id: string;
      name: string;
    } | null;
  };
  proficiency_level: WorkerSkillLevel;
  experience_years: number;
  created_at: string;
  updated_at: string;
}

export interface WorkerSkillCreatePayload {
  skill_id: string;
  proficiency_level: WorkerSkillLevel;
  experience_years: number;
}

export interface WorkerSkillUpdatePayload {
  proficiency_level: WorkerSkillLevel;
  experience_years: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");

function getApiUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new Error(
      "آدرس سرور مشخص نشده است. مقدار NEXT_PUBLIC_API_BASE_URL را در فایل frontend/.env.local تنظیم کنید.",
    );
  }

  return `${API_BASE_URL}${path}`;
}

function getApiErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const data = payload as Record<string, unknown>;

    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }

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
      return "اطلاعات مهارت معتبر نیست یا این مهارت قبلاً ثبت شده است.";
    case 401:
      return "برای مدیریت مهارت‌ها ابتدا وارد حساب کاربری شوید یا دوباره وارد شوید.";
    case 403:
      return "اجازه انجام این عملیات را ندارید.";
    case 404:
      return "مهارت یا مسیر API پیدا نشد. آدرس Backend را بررسی کنید.";
    case 429:
      return "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.";
    default:
      return status >= 500
        ? "در سرور مشکلی پیش آمده است. کمی بعد دوباره تلاش کنید."
        : "ارتباط با API مهارت‌ها با خطا مواجه شد.";
  }
}

async function apiRequest<T>(
  path: string,
  options: {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    requiresAuth?: boolean;
  },
): Promise<T> {
  const token = getAccessToken();
  const requiresAuth = options.requiresAuth ?? true;

  if (requiresAuth && !token) {
    throw new Error("برای مشاهده یا مدیریت مهارت‌های خود ابتدا وارد حساب کاربری شوید.");
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
  };

  let response: Response;
  try {
    response = await fetch(getApiUrl(path), {
      method: options.method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
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

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, response.status));
  }

  if (response.status === 204) return undefined as T;
  return payload as T;
}

/** Public catalog of selectable skills. */
export function getSkillsCatalog(): Promise<SkillCatalogItem[]> {
  return apiRequest<SkillCatalogItem[]>("/api/skills/", {
    method: "GET",
    requiresAuth: false,
  });
}

/** Skills saved on the currently authenticated worker profile. */
export function getMySkills(): Promise<WorkerSkillRecord[]> {
  return apiRequest<WorkerSkillRecord[]>("/api/profile/me/skills/", {
    method: "GET",
  });
}

export function addMySkill(payload: WorkerSkillCreatePayload): Promise<WorkerSkillRecord> {
  return apiRequest<WorkerSkillRecord>("/api/profile/me/skills/", {
    method: "POST",
    body: payload,
  });
}

export function updateMySkill(
  workerSkillId: string,
  payload: WorkerSkillUpdatePayload,
): Promise<WorkerSkillRecord> {
  return apiRequest<WorkerSkillRecord>(
    `/api/profile/me/skills/${encodeURIComponent(workerSkillId)}/`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export function deleteMySkill(workerSkillId: string): Promise<void> {
  return apiRequest<void>(
    `/api/profile/me/skills/${encodeURIComponent(workerSkillId)}/`,
    { method: "DELETE" },
  );
}
