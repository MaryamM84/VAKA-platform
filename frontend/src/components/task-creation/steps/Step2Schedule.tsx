"use client";

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
  "w-full min-w-0 rounded-xl border border-[#dce7e1] bg-white px-4 py-3 text-sm text-[#182522] outline-none transition placeholder:text-[#a0aaa5] focus:border-[#006557] focus:ring-2 focus:ring-[#006557]/10";

const labelClassName =
  "mb-2 block text-sm font-bold text-[#174f46]";

const helperClassName =
  "mt-2 text-xs leading-6 text-[#84918b]";

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} دقیقه`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) return `${hours} ساعت`;

  return `${hours} ساعت و ${remainingMinutes} دقیقه`;
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

export default function Step2Schedule({
  data,
  onChange,
}: Step2ScheduleProps) {
  const selectedDuration = Number(data.estimatedDurationMinutes);

  function renderDateTimeField(
    title: string,
    description: string,
    field: "proposalDeadlineAt" | "executionWindowEndAt" | "deadlineAt",
    required = false,
  ) {
    const currentValue = toPickerValue(data[field]);

    return (
      <section
        key={field}
        className="rounded-2xl bg-[#f0f8f4] p-4 sm:p-5"
      >
        <label className={labelClassName}>
          <span className="ml-2 text-[#006557]">📅</span>
          {title}
          {required && <span className="mr-1 text-red-500">*</span>}
        </label>

        <p className={helperClassName}>{description}</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-2 block text-xs font-semibold text-[#65766e]">
              تاریخ شمسی
            </span>

            <DatePicker
              calendar={persian}
              locale={persian_fa}
              value={currentValue}
              onChange={(date) => {
                if (!date) {
                  onChange(field, "");
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
              calendarPosition="bottom-right"
              inputClass={inputClassName}
              containerClassName="w-full"
              placeholder="انتخاب تاریخ"
              required={required}
            />
          </div>

          <div>
              <span className="mb-2 block text-xs font-semibold text-[#65766e]">
                ساعت
              </span>

              <input
                type="time"
                value={
                  currentValue
                    ? `${String(currentValue.getHours()).padStart(2, "0")}:${String(
                        currentValue.getMinutes()
                      ).padStart(2, "0")}`
                    : ""
                }
                onChange={(event) => {
                  if (!event.target.value || !currentValue) return;
                
                  const [hour, minute] = event.target.value
                    .split(":")
                    .map(Number);
                
                  const updated = new Date(currentValue);
                  updated.setHours(hour, minute, 0, 0);
                            
                  const localValue =
                    `${updated.getFullYear()}-${String(
                      updated.getMonth() + 1
                    ).padStart(2, "0")}-${String(
                      updated.getDate()
                    ).padStart(2, "0")}T${String(hour).padStart(
                      2,
                      "0"
                    )}:${String(minute).padStart(2, "0")}`;
                
                  onChange(field, localValue);
                }}
                className={inputClassName}
                aria-label="انتخاب ساعت"
              />
            </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* مدت تخمینی انجام کار */}
      <section className="rounded-2xl bg-[#f0f8f4] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="estimated-duration"
            className={labelClassName}
          >
            <span className="ml-2 text-[#006557]">●</span>
            مدت زمان تخمینی انجام کار
            <span className="mr-1 text-red-500">*</span>
          </label>

          <span className="rounded-full bg-white px-3 py-1 text-xs text-[#84918b]">
            برحسب دقیقه
          </span>
        </div>

        {/* قانون استاندارد */}
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e0ece5] bg-white/80 p-3 sm:p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#dcece5] text-xl">
            ⏱️
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-6 text-[#174f46]">
              قانون استانداردهای زمانی در شبکه واکا
            </p>

            <p className="mt-1 text-xs leading-6 text-[#65766e]">
              مدت زمان اجرای هر کار در پلتفرم واکا باید بین حداقل
              ۱ دقیقه و حداکثر ۳۰۰ دقیقه (۵ ساعت خالص) تعریف شود.
              برای پروژه‌های بزرگ‌تر، کار باید به چند کار مستقل
              تقسیم شود.
            </p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#35433d]">
            مدت زمان تقریبی مورد نیاز
          </p>
          <span className="text-xs text-[#84918b]">
            حداکثر ۵ ساعت
          </span>
        </div>

        {/* گزینه‌های آماده */}
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
                    ? "border-[#006557] bg-[#006557] text-white shadow-sm"
                    : "border-transparent bg-white text-[#35433d] hover:border-[#b9d5ca] hover:bg-[#f9fcfa]"
                }`}
              >
                {isSelected && (
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#ffb77b] text-xs text-[#663b17]">
                    ✓
                  </span>
                )}

                <span className="text-base font-bold">
                  {minutes}
                </span>

                <span
                  className={`mt-1 text-xs ${
                    isSelected ? "text-white/80" : "text-[#84918b]"
                  }`}
                >
                  دقیقه
                </span>
              </button>
            );
          })}
        </div>

        {/* ورود دستی مدت */}
        <div className="mt-4 rounded-xl bg-white/80 p-3 sm:p-4">
          <label
            htmlFor="estimated-duration"
            className="mb-2 block text-sm font-semibold text-[#35433d]"
          >
            یا مدت دلخواه را وارد کنید
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:max-w-[220px]">
              <input
                id="estimated-duration"
                type="number"
                min={1}
                max={300}
                step={1}
                required
                value={data.estimatedDurationMinutes}
                onChange={(event) =>
                  onChange(
                    "estimatedDurationMinutes",
                    event.target.value
                  )
                }
                placeholder="مثلاً ۴۵"
                aria-describedby="duration-help"
                className={inputClassName}
              />
            </div>

            <span className="text-sm text-[#65766e]">
              {selectedDuration > 0 && selectedDuration <= 300
                ? `زمان انتخاب‌شده: ${formatMinutes(selectedDuration)}`
                : "از ۱ تا ۳۰۰ دقیقه"}
            </span>
          </div>

          <p id="duration-help" className={helperClassName}>
            مدت تقریبی انجام خودِ کار را وارد کنید، نه زمان انتظار
            برای انتخاب مجری.
          </p>
        </div>
      </section>

      {/* فوریت کار */}
      <section className="rounded-2xl bg-[#f0f8f4] p-4 sm:p-5">
        <div className="mb-4">
          <h3 className={labelClassName}>
            <span className="ml-2 text-[#006557]">●</span>
            زمان شروع و فوریت کار
            <span className="mr-1 text-red-500">*</span>
          </h3>

          <p className={helperClassName}>
            میزان فوریت را با توجه به زمان مورد نیاز برای شروع کار
            انتخاب کنید.
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
                    ? "border-[#80b7a8] bg-[#e0ece5] shadow-sm"
                    : "border-transparent bg-white hover:border-[#c9ddd3]"
                }`}
              >
                <input
                  type="radio"
                  name="task-urgency"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onChange("urgency", option.value)}
                  className="mt-1 size-4 shrink-0 accent-[#006557]"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#263b34]">
                      {option.title}
                    </span>

                    <span
                      className={`rounded-full px-2 py-1 text-[11px] ${
                        option.value === "urgent"
                          ? "bg-[#ffe1dc] text-[#a34435]"
                          : "bg-[#dcece5] text-[#17695a]"
                      }`}
                    >
                      {option.badge}
                    </span>
                  </span>

                  <span className="mt-2 block text-xs leading-6 text-[#65766e]">
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
