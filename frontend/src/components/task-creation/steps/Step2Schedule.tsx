"use client";

import { useState } from "react";
import type { TaskFormData } from "../types";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

interface Step2ScheduleProps {
  data: TaskFormData;
  onChange: (field: keyof TaskFormData, value: string) => void;
}

const durationOptions = [15, 30, 45, 60, 120, 180];

const inputClassName =
  "w-full min-w-0 rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-surface)] px-4 py-3 text-sm text-[var(--vaka-text)] outline-none transition placeholder:text-[var(--vaka-text-muted)] focus:border-[var(--vaka-primary)] focus:ring-2 focus:ring-[var(--vaka-primary)]/10";

const labelClassName =
  "mb-2 block text-sm font-bold text-[var(--vaka-primary)]";

const helperClassName = "mt-2 text-xs leading-6 text-[var(--vaka-text-muted)]";

function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function toEnglishDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${toPersianDigits(minutes)} دقیقه`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${toPersianDigits(hours)} ساعت`;
  }

  return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(
    remainingMinutes,
  )} دقیقه`;
}

function toPickerValue(value: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function toLocalDateTime(value: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}) {
  const year = value.year;
  const month = String(value.month).padStart(2, "0");
  const day = String(value.day).padStart(2, "0");
  const hour = String(value.hour ?? 0).padStart(2, "0");
  const minute = String(value.minute ?? 0).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatTime(value: Date | null): string {
  if (!value) return "";

  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");

  return toPersianDigits(`${hour}:${minute}`);
}

function normalizeTimeInput(value: string): string {
  const digits = toEnglishDigits(value).replace(/[^\d:]/g, "");

  if (digits.includes(":")) {
    const [hour = "", minute = ""] = digits.split(":");

    if (digits.split(":").length > 2) return "";

    return `${hour.slice(0, 2)}:${minute.slice(0, 2)}`;
  }

  const limited = digits.slice(0, 4);

  if (limited.length <= 2) return limited;

  return `${limited.slice(0, 2)}:${limited.slice(2)}`;
}

export default function Step2Schedule({ data, onChange }: Step2ScheduleProps) {
  const selectedDuration = Number(data.estimatedDurationMinutes);

  const [timeDrafts, setTimeDrafts] = useState<
    Partial<
      Record<
        "proposalDeadlineAt" | "executionWindowEndAt" | "deadlineAt",
        string
      >
    >
  >({});

  const [timeErrors, setTimeErrors] = useState<
    Partial<
      Record<
        "proposalDeadlineAt" | "executionWindowEndAt" | "deadlineAt",
        string
      >
    >
  >({});

  function renderDateTimeField(
    title: string,
    description: string,
    field: "proposalDeadlineAt" | "executionWindowEndAt" | "deadlineAt",
    required = false,
  ) {
    const currentValue = toPickerValue(data[field]);

    const displayedTime =
      timeDrafts[field] !== undefined
        ? timeDrafts[field]!
        : formatTime(currentValue);

    return (
      <section
        key={field}
        className="rounded-2xl bg-[var(--vaka-primary-pale)] p-4 sm:p-5"
      >
        <label className={labelClassName}>
          <span className="ml-2 text-[var(--vaka-primary)]">📅</span>
          {title}
          {required && (
            <span className="mr-1 text-[var(--vaka-danger)]">*</span>
          )}
        </label>

        <p className={helperClassName}>{description}</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-2 block text-xs font-semibold text-[var(--vaka-text-secondary)]">
              تاریخ شمسی
            </span>

            <div className="relative">
              <DatePicker
                calendar={persian}
                locale={persian_fa}
                digits={["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"]}
                value={currentValue}
                onChange={(date) => {
                  if (!date) {
                    onChange(field, "");
                    setTimeDrafts((previous) => ({
                      ...previous,
                      [field]: "",
                    }));
                    setTimeErrors((previous) => ({
                      ...previous,
                      [field]: "",
                    }));
                    return;
                  }

                  const hour = currentValue?.getHours() ?? 0;
                  const minute = currentValue?.getMinutes() ?? 0;

                  onChange(
                    field,
                    toLocalDateTime({
                      year: date.year,
                      month: date.month.number,
                      day: date.day,
                      hour,
                      minute,
                    }),
                  );
                }}
                format="YYYY/MM/DD"
                calendarPosition="bottom-left"
                inputClass={`${inputClassName} pl-11 text-left [direction:ltr]`}
                containerClassName="w-full"
                placeholder="انتخاب تاریخ"
                required={required}
              />

              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vaka-text-muted)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18" />
                </svg>
              </span>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold text-[var(--vaka-text-secondary)]">
              ساعت
            </span>

            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              autoComplete="off"
              maxLength={5}
              value={displayedTime}
              placeholder="۱۴:۳۰"
              aria-label="انتخاب ساعت"
              aria-invalid={Boolean(timeErrors[field])}
              onChange={(event) => {
                const normalized = normalizeTimeInput(event.target.value);

                setTimeDrafts((previous) => ({
                  ...previous,
                  [field]: toPersianDigits(normalized),
                }));

                setTimeErrors((previous) => ({
                  ...previous,
                  [field]: "",
                }));

                if (!currentValue || normalized.length !== 5) return;

                const match = /^(\d{2}):(\d{2})$/.exec(normalized);

                if (!match) return;

                const hour = Number(match[1]);
                const minute = Number(match[2]);

                if (hour > 23 || minute > 59) {
                  setTimeErrors((previous) => ({
                    ...previous,
                    [field]: "ساعت یا دقیقه واردشده معتبر نیست.",
                  }));
                  return;
                }

                const updated = new Date(currentValue);

                updated.setHours(hour, minute, 0, 0);

                const localValue = `${updated.getFullYear()}-${String(
                  updated.getMonth() + 1,
                ).padStart(2, "0")}-${String(updated.getDate()).padStart(
                  2,
                  "0",
                )}T${String(hour).padStart(
                  2,
                  "0",
                )}:${String(minute).padStart(2, "0")}`;

                onChange(field, localValue);
              }}
              className={`${inputClassName} text-left`}
            />

            {timeErrors[field] ? (
              <p className="mt-2 text-xs text-[var(--vaka-danger)]">
                {timeErrors[field]}
              </p>
            ) : (
              <p className={helperClassName}>ساعت را مانند ۱۴:۳۰ وارد کنید.</p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* مدت تخمینی انجام کار */}
      <section className="rounded-2xl bg-[var(--vaka-primary-pale)] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="estimated-duration" className={labelClassName}>
            <span className="ml-2 text-[var(--vaka-primary)]">●</span>
            مدت زمان تخمینی انجام کار
            <span className="mr-1 text-[var(--vaka-danger)]">*</span>
          </label>

          <span className="rounded-full bg-[var(--vaka-surface)] px-3 py-1 text-xs text-[var(--vaka-text-muted)]">
            برحسب دقیقه
          </span>
        </div>

        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-surface)]/80 p-3 sm:p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--vaka-primary-soft)] text-xl">
            ⏱️
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-6 text-[var(--vaka-primary)]">
              قانون استانداردهای زمانی در شبکه واکا
            </p>

            <p className="mt-1 text-xs leading-6 text-[var(--vaka-text-secondary)]">
              مدت زمان اجرای هر کار در پلتفرم واکا باید بین حداقل ۱ دقیقه و
              حداکثر ۳۰۰ دقیقه (۵ ساعت خالص) تعریف شود. برای پروژه‌های بزرگ‌تر،
              کار باید به چند کار مستقل تقسیم شود.
            </p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--vaka-text)]">
            مدت زمان تقریبی مورد نیاز
          </p>

          <span className="text-xs text-[var(--vaka-text-muted)]">
            حداکثر ۵ ساعت
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {durationOptions.map((minutes) => {
            const isSelected = selectedDuration === minutes;

            return (
              <button
                key={minutes}
                type="button"
                onClick={() =>
                  onChange("estimatedDurationMinutes", String(minutes))
                }
                aria-pressed={isSelected}
                className={`relative flex min-h-[68px] flex-col items-center justify-center rounded-xl border px-2 py-3 transition ${
                  isSelected
                    ? "border-[var(--vaka-primary)] bg-[var(--vaka-primary)] text-[var(--vaka-surface)] shadow-sm"
                    : "border-transparent bg-[var(--vaka-surface)] text-[var(--vaka-text)] hover:border-[var(--vaka-border)] hover:bg-[var(--vaka-primary-pale)]"
                }`}
              >
                {isSelected && (
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[var(--vaka-warning)] text-xs text-[var(--vaka-surface)]">
                    ✓
                  </span>
                )}

                <span className="text-base font-bold">
                  {toPersianDigits(minutes)}
                </span>

                <span
                  className={`mt-1 text-xs ${
                    isSelected
                      ? "text-[var(--vaka-surface)]/80"
                      : "text-[var(--vaka-text-muted)]"
                  }`}
                >
                  دقیقه
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl bg-[var(--vaka-surface)]/80 p-3 sm:p-4">
          <label
            htmlFor="estimated-duration"
            className="mb-2 block text-sm font-semibold text-[var(--vaka-text)]"
          >
            یا مدت دلخواه را وارد کنید
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:max-w-[220px]">
              <input
                id="estimated-duration"
                type="text"
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                required
                maxLength={3}
                value={toPersianDigits(data.estimatedDurationMinutes)}
                onChange={(event) => {
                  const normalized = toEnglishDigits(event.target.value)
                    .replace(/\D/g, "")
                    .slice(0, 3);

                  const safeValue =
                    normalized !== "" && Number(normalized) > 300
                      ? "300"
                      : normalized;

                  onChange("estimatedDurationMinutes", safeValue);
                }}
                placeholder="مثلاً ۴۵"
                aria-describedby="duration-help"
                className={`${inputClassName} text-left`}
              />
            </div>

            <span className="text-sm text-[var(--vaka-text-secondary)]">
              {selectedDuration > 0 && selectedDuration <= 300
                ? `زمان انتخاب‌شده: ${formatMinutes(selectedDuration)}`
                : "از ۱ تا ۳۰۰ دقیقه"}
            </span>
          </div>

          <p id="duration-help" className={helperClassName}>
            مدت تقریبی انجام خودِ کار را وارد کنید، نه زمان انتظار برای انتخاب
            مجری.
          </p>
        </div>
      </section>

      {/* فوریت کار */}
      <section className="rounded-2xl bg-[var(--vaka-primary-pale)] p-4 sm:p-5">
        <div className="mb-4">
          <h3 className={labelClassName}>
            <span className="ml-2 text-[var(--vaka-primary)]">●</span>
            زمان شروع و فوریت کار
            <span className="mr-1 text-[var(--vaka-danger)]">*</span>
          </h3>

          <p className={helperClassName}>
            میزان فوریت را با توجه به زمان مورد نیاز برای شروع کار انتخاب کنید.
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              value: "normal",
              title: "عادی",
              badge: "زمان‌بندی معمول",
              description:
                "کار در بازه زمانی مشخص‌شده انجام می‌شود و برای شروع فوری آن اولویتی در نظر گرفته نمی‌شود.",
            },
            {
              value: "urgent",
              title: "فوری",
              badge: "نیازمند شروع سریع",
              description:
                "سفارش شما در اولویت صف مجریان فعال نزدیک به موقعیت مکانی قرار می‌گیرد.",
            },
          ].map((option) => {
            const isSelected = data.urgency === option.value;

            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  isSelected
                    ? "border-[var(--vaka-primary)] bg-[var(--vaka-primary-soft)] shadow-sm"
                    : "border-transparent bg-[var(--vaka-surface)] hover:border-[var(--vaka-border)]"
                }`}
              >
                <input
                  type="radio"
                  name="task-urgency"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onChange("urgency", option.value)}
                  className="mt-1 size-4 shrink-0 accent-[var(--vaka-primary)]"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[var(--vaka-text)]">
                      {option.title}
                    </span>

                    <span
                      className={`rounded-full px-2 py-1 text-[11px] ${
                        option.value === "urgent"
                          ? "bg-[var(--vaka-danger)]/10 text-[var(--vaka-danger)]"
                          : "bg-[var(--vaka-primary-soft)] text-[var(--vaka-primary)]"
                      }`}
                    >
                      {option.badge}
                    </span>
                  </span>

                  <span className="mt-2 block text-xs leading-6 text-[var(--vaka-text-secondary)]">
                    {option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {renderDateTimeField(
        "آخرین مهلت دریافت پیشنهادها",
        "تا چه تاریخ و ساعتی مجریان فرصت دارند پیشنهادشان را ثبت کنند؟",
        "proposalDeadlineAt",
        true,
      )}

      {renderDateTimeField(
        "پایان بازه مجاز انجام کار",
        "آخرین زمان بازه‌ای که انجام کار در آن مجاز است.",
        "executionWindowEndAt",
        true,
      )}

      {renderDateTimeField(
        "مهلت نهایی انجام کار",
        "اگر برای تکمیل کار مهلت نهایی مشخصی دارید، آن را انتخاب کنید. این مورد اختیاری است.",
        "deadlineAt",
      )}
    </div>
  );
}
