export type FieldStatus = "default" | "error" | "success";

const base =
  "h-11 w-full rounded-xl border-[1.5px] text-sm outline-none transition";

const statusClass: Record<FieldStatus, string> = {
  default:
    "border-[var(--vaka-auth-input-border)] bg-[var(--vaka-auth-surface)] text-[var(--vaka-auth-heading)] placeholder:text-[var(--vaka-auth-placeholder)] focus:border-[var(--vaka-auth-primary)] focus:ring-4 focus:ring-[var(--vaka-auth-primary)]/10",
  error:
    "border-[var(--vaka-auth-error-border)] bg-[var(--vaka-auth-error-bg)] text-[var(--vaka-auth-error)] placeholder:text-[var(--vaka-auth-error-placeholder)] focus:border-[var(--vaka-auth-error-border)] focus:ring-4 focus:ring-[var(--vaka-auth-error)]/15",
  success:
    "border-[var(--vaka-auth-primary)] bg-[var(--vaka-auth-surface)] text-[var(--vaka-auth-heading)] placeholder:text-[var(--vaka-auth-placeholder)] focus:border-[var(--vaka-auth-primary)] focus:ring-4 focus:ring-[var(--vaka-auth-primary)]/10",
};

/** Input styles selected by validation state. */
export const inputClass = (status: FieldStatus = "default") =>
  `${base} ${statusClass[status]}`;

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Convert Persian and Arabic-Indic digits to ASCII digits for API payloads. */
export const toEn = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String(FA_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(AR_DIGITS.indexOf(digit)));

/** Convert ASCII digits to Persian digits for display. */
export const toFa = (value: string) =>
  value.replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);

/** Keep only digits and normalize Iranian mobile numbers to 11 ASCII digits. */
export const normalizePhone = (value: string) =>
  toEn(value).replace(/\D/g, "").slice(0, 11);

export function validatePhone(value: string) {
  if (!value) return "شماره موبایل الزامی است";
  if (!/^09\d{9}$/.test(value)) {
    return "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)";
  }
  return "";
}

export function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="10" fill="var(--vaka-auth-error-icon)" />
      <path d="M12 7v6" stroke="var(--vaka-auth-on-error)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1.2" fill="var(--vaka-auth-on-error)" />
    </svg>
  );
}

export function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="10" fill="var(--vaka-auth-success)" />
      <path
        d="M7.5 12.4l3 3 6-6.4"
        fill="none"
        stroke="var(--vaka-auth-on-primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FieldError({
  id,
  message,
}: {
  id?: string;
  message?: string;
}) {
  if (!message) return null;

  return (
    <div
      id={id}
      role="alert"
      className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[var(--vaka-auth-error-soft-bg)] px-3 py-2 text-[11px] font-medium text-[var(--vaka-auth-error-soft-text)]"
    >
      <span>{message}</span>
      <ErrorIcon className="h-4 w-4 shrink-0" />
    </div>
  );
}
