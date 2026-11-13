import { getAccessToken } from "./auth-api";

export type WorkerVerificationStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface WorkerProfileSummary {
  full_name: string;
  verification_status: WorkerVerificationStatus;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");

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

    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }

    const messages = Object.entries(data).flatMap(([field, value]) => {
      const values = Array.isArray(value) ? value : [value];

      return values
        .filter((item): item is string => typeof item === "string")
        .map((item) => `${field}: ${item}`);
    });

    if (messages.length > 0) return messages.join(" ");
  }

  switch (status) {
    case 401:
      return "برای دریافت اطلاعات پروفایل ابتدا وارد حساب کاربری شوید.";
    case 403:
      return "اجازه مشاهده اطلاعات این حساب را ندارید.";
    case 404:
      return "مسیر API اطلاعات پروفایل پیدا نشد.";
    default:
      return status >= 500
        ? "در سرور مشکلی پیش آمده است. کمی بعد دوباره تلاش کنید."
        : "دریافت اطلاعات پروفایل با خطا مواجه شد.";
  }
}

/**
 * Fetches the current user's display name and verification state.
 * The profile endpoint already includes verification_status, so this page
 * does not need a second request to /profile/me/verification/.
 */
export async function getMyProfileSummary(): Promise<WorkerProfileSummary> {
  const token = getAccessToken();

  if (!token) {
    throw new Error("برای مشاهده اطلاعات پروفایل ابتدا وارد حساب کاربری شوید.");
  }

  let response: Response;

  try {
    response = await fetch(getApiUrl("/api/profile/me/"), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
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

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as Record<string, unknown>).full_name !== "string" ||
    typeof (payload as Record<string, unknown>).verification_status !== "string"
  ) {
    throw new Error("ساختار پاسخ API اطلاعات پروفایل معتبر نیست.");
  }

  const data = payload as Record<string, unknown>;
  const status = data.verification_status;

  if (
    status !== "NOT_SUBMITTED" &&
    status !== "PENDING" &&
    status !== "APPROVED" &&
    status !== "REJECTED"
  ) {
    throw new Error("وضعیت احراز هویت دریافتی از سرور معتبر نیست.");
  }

  return {
    full_name: data.full_name as string,
    verification_status: status,
  };
}
