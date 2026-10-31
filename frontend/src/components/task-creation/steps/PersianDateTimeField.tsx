"use client";

import { useState } from "react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

interface PersianDateTimeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  optional?: boolean;
}

function getCurrentDateTime() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate(),
    )}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

export default function PersianDateTimeField({
  id,
  label,
  value,
  onChange,
  required = false,
  optional = false,
}: PersianDateTimeFieldProps) {
  const initial = getCurrentDateTime();

  const [dateValue, setDateValue] = useState(
    value.split("T")[0] || initial.date,
  );

  const [timeValue, setTimeValue] = useState(
    value.split("T")[1] || initial.time,
  );

  function updateDate(date: string) {
    setDateValue(date);
    onChange(`${date}T${timeValue}`);
  }

  function updateTime(time: string) {
    setTimeValue(time);
    onChange(`${dateValue}T${time}`);
  }

  return (
    <section
      className={`rounded-2xl p-4 sm:p-5 ${
        optional
          ? "border border-[var(--vaka-border)] bg-[var(--vaka-surface)]"
          : "bg-[var(--vaka-primary-pale)]"
      }`}
    >
      <label className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--vaka-primary)]">
        <span className="text-[var(--vaka-primary)]" aria-hidden="true">
          {optional ? "○" : "●"}
        </span>

        {label}

        {required && <span className="text-[var(--vaka-danger)]">*</span>}

        {optional && (
          <span className="text-xs font-normal text-[var(--vaka-text-muted)]">
            (اختیاری)
          </span>
        )}
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
        <div className="relative">
          <DatePicker
            calendar={persian}
            locale={persian_fa}
            calendarPosition="bottom-right"
            value={dateValue}
            onChange={(date) => {
              if (date) {
                const gregorianDate = date
                  .convert(undefined, undefined)
                  .toDate();

                const pad = (n: number) => String(n).padStart(2, "0");

                updateDate(
                  `${gregorianDate.getFullYear()}-${pad(
                    gregorianDate.getMonth() + 1,
                  )}-${pad(gregorianDate.getDate())}`,
                );
              }
            }}
            format="YYYY/MM/DD"
            inputClass="w-full rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-surface)] px-4 py-3 text-sm text-[var(--vaka-text)] outline-none focus:border-[var(--vaka-primary)] focus:ring-2 focus:ring-[var(--vaka-primary)]/10"
            containerClassName="w-full"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-time`}
            className="mb-1 block text-xs text-[var(--vaka-text-muted)]"
          >
            ساعت
          </label>

          <input
            id={`${id}-time`}
            type="time"
            value={timeValue}
            onChange={(event) => updateTime(event.target.value)}
            required={required}
            className="w-full rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-surface)] px-3 py-3 text-sm text-[var(--vaka-text)] outline-none focus:border-[var(--vaka-primary)] focus:ring-2 focus:ring-[var(--vaka-primary)]/10"
          />
        </div>
      </div>
    </section>
  );
}
