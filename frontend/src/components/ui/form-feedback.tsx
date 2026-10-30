export type FieldStatus = "default" | "error" | "success";

const base =
  "h-11 w-full rounded-xl border-[1.5px] text-sm outline-none transition";

const statusClass: Record<FieldStatus, string> = {
  default:
    "border-[#cfdad6] bg-white text-[#263746] placeholder:text-[#9aa8b6] focus:border-[#16866f] focus:ring-4 focus:ring-[#16866f]/10",
  error:
    "border-[#e5707a] bg-[#fff6f6] text-[#c8404b] placeholder:text-[#d98a90] focus:border-[#e5707a] focus:ring-4 focus:ring-[#e5707a]/15",
  success:
    "border-[#16866f] bg-white text-[#263746] placeholder:text-[#9aa8b6] focus:border-[#16866f] focus:ring-4 focus:ring-[#16866f]/10",
};

/** کلاس‌های فیلد ورودی بر اساس وضعیت */
export const inputClass = (status: FieldStatus = "default") =>
  `${base} ${statusClass[status]}`;

/* ---------- آیکون‌ها ---------- */

export function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="10" fill="#e0545c" />
      <path d="M12 7v6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1.2" fill="#fff" />
    </svg>
  );
}

export function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="10" fill="#0f7f6b" />
      <path
        d="M7.5 12.4l3 3 6-6.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- نوار پیام خطا (فیلد یا کل فرم) ---------- */

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
      className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#fdeeee] px-3 py-2 text-[11px] font-medium text-[#d64550]"
    >
      <span>{message}</span>
      <ErrorIcon className="h-4 w-4 shrink-0" />
    </div>
  );
}

/* ---------- ابزارهای شماره موبایل ---------- */

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export const toEn = (value: string) =>
  value
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

/** ارقام فارسی را انگلیسی می‌کند، غیر عدد را حذف و طول را ۱۱ رقم نگه می‌دارد */
export const normalizePhone = (value: string) =>
  toEn(value).replace(/\D/g, "").slice(0, 11);

export function validatePhone(value: string) {
  if (!value) return "شماره موبایل الزامی است";
  if (!/^09\d{9}$/.test(value))
    return "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)";
  return "";
}