/**
 * VAKA authentication API client.
 * The OpenAPI document contains paths and schemas but does not define a server URL.
 * Set NEXT_PUBLIC_API_BASE_URL to the backend origin (without a trailing slash or /api).
 */

export type OtpPurpose = "LOGIN" | "REGISTER";

export interface AuthUser {
  user_id: string;
  phone: string;
  full_name: string;
}

export interface AuthResponse {
  user: AuthUser;
  access: string;
  refresh: string;
}

export interface OtpPendingResponse {
  detail: string;
  requires_verification: boolean;
}

interface OtpVerifyPayload {
  phone: string;
  code: string;
}

export interface TokenRefreshResponse {
  access: string;
  refresh?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");

function getEndpoint(path: string): string {
  if (!API_BASE_URL) {
    throw new Error(
      "آدرس سرور مشخص نشده است. مقدار NEXT_PUBLIC_API_BASE_URL را در فایل .env.local تنظیم کنید."
    );
  }

  return `${API_BASE_URL}${path}`;
}

function getApiErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    const detail = data.detail;

    if (typeof detail === "string" && detail.trim()) {
      const normalized = detail.toLowerCase();
      if (normalized.includes("invalid phone number or password")) {
        return "شماره موبایل یا رمز عبور اشتباه است.";
      }
      return detail;
    }

    const errors = (data.errors ?? data) as Record<string, unknown>;
    if (errors && typeof errors === "object" && !Array.isArray(errors)) {
      const labels: Record<string, string> = {
        phone: "شماره موبایل",
        password: "رمز عبور",
        password_confirm: "تکرار رمز عبور",
        code: "کد تأیید",
        non_field_errors: "اطلاعات واردشده",
      };

      const messages = Object.entries(errors)
        .filter(([key]) => key !== "detail" && key !== "errors")
        .flatMap(([key, value]) => {
          const list = Array.isArray(value) ? value : [value];
          return list
            .filter((item): item is string => typeof item === "string")
            .map((item) => `${labels[key] ?? key}: ${item}`);
        });

      if (messages.length) return messages.join(" ");
    }
  }

  switch (status) {
    case 400:
      return "اطلاعات واردشده معتبر نیست. لطفاً موارد فرم را بررسی کنید.";
    case 401:
      return "اطلاعات ورود صحیح نیست یا کد تأیید اعتبار ندارد.";
    case 403:
      return "اجازه انجام این درخواست را ندارید.";
    case 404:
      return "مسیر API پیدا نشد. آدرس سرور و مسیرهای بک‌اند را بررسی کنید.";
    case 409:
      return "این درخواست با وضعیت فعلی حساب سازگار نیست.";
    case 429:
      return "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.";
    default:
      return status >= 500
        ? "در سرور مشکلی پیش آمده است. کمی بعد دوباره تلاش کنید."
        : "انجام درخواست با خطا مواجه شد. دوباره تلاش کنید.";
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const endpoint = getEndpoint(path);
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("ارتباط با سرور برقرار نشد. اتصال اینترنت و آدرس API را بررسی کنید.");
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

  return payload as T;
}

export function loginWithPassword(phone: string, password: string) {
  return postJson<AuthResponse>("/api/auth/login/password/", { phone, password });
}

export function sendLoginOtp(phone: string) {
  return postJson<void>("/api/auth/login/otp/send/", { phone });
}

export function verifyLoginOtp(payload: OtpVerifyPayload) {
  return postJson<AuthResponse>("/api/auth/login/otp/verify/", payload);
}

export function registerWithPassword(
  phone: string,
  password: string,
  passwordConfirm: string
) {
  return postJson<OtpPendingResponse>("/api/auth/register/", {
    phone,
    password,
    password_confirm: passwordConfirm,
  });
}

export function verifyRegistrationOtp(payload: OtpVerifyPayload) {
  return postJson<AuthResponse>("/api/auth/register/verify-otp/", payload);
}

export function resendOtp(phone: string, purpose: OtpPurpose) {
  return postJson<void>("/api/auth/otp/resend/", { phone, purpose });
}

export function refreshAccessToken(refresh: string) {
  return postJson<TokenRefreshResponse>("/api/auth/token/refresh/", { refresh });
}

export function verifyAccessToken(token: string) {
  return postJson<void>("/api/auth/token/verify/", { token });
}

/**
 * Stores the JWT response for the current browser session.
 * `rememberMe=true` uses localStorage; otherwise sessionStorage is used.
 * For production, an HttpOnly + Secure + SameSite cookie managed by the backend
 * is safer than exposing JWTs to browser JavaScript.
 */
export function saveAuthSession(auth: AuthResponse, rememberMe: boolean): void {
  if (typeof window === "undefined") return;

  const key = "vaka.auth";
  try {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
    const storage = rememberMe ? window.localStorage : window.sessionStorage;
    storage.setItem(key, JSON.stringify(auth));
  } catch {
    throw new Error(
      "ورود موفق بود، اما مرورگر اجازه ذخیره نشست را نداد. تنظیمات ذخیره‌سازی مرورگر را بررسی کنید."
    );
  }
}

export function getAuthRedirectPath(): string {
  const configuredPath = process.env.NEXT_PUBLIC_AUTH_REDIRECT_PATH?.trim();
  return configuredPath?.startsWith("/") ? configuredPath : "/welcome";
}


/**
 * Returns the current user's access token.
 * Checks persistent and session storage.
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  const key = "vaka.auth";

  try {
    const storedAuth =
      window.localStorage.getItem(key) ??
      window.sessionStorage.getItem(key);

    if (!storedAuth) return null;

    const auth = JSON.parse(storedAuth) as Partial<AuthResponse>;

    return typeof auth.access === "string" && auth.access.trim()
      ? auth.access
      : null;
  } catch {
    return null;
  }
}