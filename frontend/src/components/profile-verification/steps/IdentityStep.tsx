"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import type { IdentityFormData } from "../types";
import { getIdentityErrors, normalizeIban, onlyDigits } from "../validation";
import { toPersianDigits } from "../utils/number-utils";

interface IdentityStepProps {
  data: IdentityFormData;
  onChange: (data: IdentityFormData) => void;
  onNext: () => void;
}

const fields: {
  name: Exclude<keyof IdentityFormData, "birthDate">;
  label: string;
  placeholder: string;
  hint: string;
}[] = [
  { name: "firstName", label: "نام", placeholder: "نام خود را وارد کنید", hint: "مطابق مدرک شناسایی" },
  { name: "lastName", label: "نام خانوادگی", placeholder: "نام خانوادگی خود را وارد کنید", hint: "مطابق مدرک شناسایی" },
  { name: "nationalCode", label: "کد ملی", placeholder: "۱۰ رقم کد ملی", hint: "اعداد فارسی و انگلیسی پذیرفته می‌شوند" },
  { name: "iban", label: "شماره شبا", placeholder: "IR000000000000000000000000", hint: "شماره شبا باید با IR شروع شود" },
  { name: "mobile", label: "شماره موبایل", placeholder: "۰۹۱۲۳۴۵۶۷۸۹", hint: "شماره موبایل به نام خودتان" },
];

const baseInput = "w-full rounded-xl border bg-white px-4 py-3 text-sm text-[var(--vaka-text)] outline-none transition placeholder:text-[var(--vaka-text-muted)] focus:border-[var(--vaka-primary)] focus:ring-2 focus:ring-[var(--vaka-primary)]/10";

export default function IdentityStep({ data, onChange, onNext }: IdentityStepProps) {
  const [today, setToday] = useState<Date | undefined>(undefined);

  useEffect(() => {
    setToday(new Date());
  }, []);

  const errors = getIdentityErrors(data, today);
  const isValid = Object.keys(errors).length === 0;

  const handleChange = (name: keyof IdentityFormData, value: string) => {
    let normalized = value;
    if (name === "nationalCode") normalized = onlyDigits(value, 10);
    if (name === "mobile") normalized = onlyDigits(value, 11);
    if (name === "iban") normalized = normalizeIban(value);
    onChange({ ...data, [name]: normalized });
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--vaka-text)]">اطلاعات هویتی</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--vaka-text-secondary)]">
          اطلاعات را دقیقاً مطابق مدارک شناسایی وارد کنید. این اطلاعات برای بررسی درخواست استفاده می‌شوند.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {fields.map((field) => {
          const error = errors[field.name];
          const storedValue = data[field.name];
          const inputValue =
            field.name === "nationalCode" || field.name === "mobile"
              ? toPersianDigits(storedValue)
              : storedValue;
          return (
            <div key={field.name} className="space-y-2">
              <label htmlFor={field.name} className="block text-sm font-semibold text-[var(--vaka-text)]">
                {field.label}<span className="mr-1 text-[var(--vaka-danger)]">*</span>
              </label>
              <input
                id={field.name}
                name={field.name}
                type="text"
                inputMode={field.name === "nationalCode" || field.name === "mobile" || field.name === "iban" ? "numeric" : "text"}
                autoComplete="off"
                value={inputValue}
                onChange={(event) => handleChange(field.name, event.target.value)}
                placeholder={field.placeholder}
                maxLength={field.name === "nationalCode" ? 10 : field.name === "mobile" ? 11 : field.name === "iban" ? 26 : 60}
                dir="rtl"
                aria-invalid={Boolean(error)}
                aria-describedby={`${field.name}-hint ${field.name}-error`}
                className={`${baseInput} ${error && inputValue ? "border-[var(--vaka-danger)]" : "border-[var(--vaka-border)]"}`}
              />
              <p id={`${field.name}-hint`} className="text-xs text-[var(--vaka-text-muted)]">{field.hint}</p>
              {error && inputValue.length > 0 && <p id={`${field.name}-error`} role="alert" className="text-xs text-[var(--vaka-danger)]">{error}</p>}
            </div>
          );
        })}

        <div className="space-y-2">
          <label htmlFor="birthDate" className="block text-sm font-semibold text-[var(--vaka-text)]">
            تاریخ تولد<span className="mr-1 text-[var(--vaka-danger)]">*</span>
          </label>
          <DatePicker
            id="birthDate"
            calendar={persian}
            locale={persian_fa}
            calendarPosition="bottom-right"
            value={data.birthDate || ""}
            onChange={(date) => handleChange("birthDate", date ? date.format("YYYY/MM/DD") : "")}
            format="YYYY/MM/DD"
            maxDate={today}
            editable={false}
            inputClass={`${baseInput} ${errors.birthDate && data.birthDate ? "border-[var(--vaka-danger)]" : "border-[var(--vaka-border)]"}`}
            containerClassName="w-full"
            placeholder="سال / ماه / روز"
          />
          <p className="text-xs text-[var(--vaka-text-muted)]">تاریخ را از تقویم شمسی انتخاب کنید.</p>
          {errors.birthDate && data.birthDate && <p role="alert" className="text-xs text-[var(--vaka-danger)]">{errors.birthDate}</p>}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-primary-pale)] p-4">
        <p className="text-xs leading-6 text-[var(--vaka-text-secondary)]">
          <strong className="text-[var(--vaka-primary)]">حفظ حریم خصوصی:</strong> اطلاعات هویتی شما فقط باید برای فرایند احراز هویت استفاده شود. از وارد کردن اطلاعات دیگران خودداری کنید.
        </p>
      </div>

      <div className="flex justify-end border-t border-[var(--vaka-border-soft)] pt-5">
        <button type="button" onClick={onNext} disabled={!isValid} className="rounded-xl bg-[var(--vaka-primary)] px-7 py-3 text-sm font-medium text-white transition hover:bg-[var(--vaka-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">
          ادامه
        </button>
      </div>
    </section>
  );
}
