
"use client";

import type { IdentityFormData } from "../types";

interface IdentityStepProps {
  data: IdentityFormData;
  onChange: (data: IdentityFormData) => void;
  onNext: () => void;
}

const fields: {
  name: keyof IdentityFormData;
  label: string;
  placeholder: string;
  type?: string;
  maxLength?: number;
}[] = [
  {
    name: "firstName",
    label: "نام",
    placeholder: "نام خود را وارد کنید",
  },
  {
    name: "lastName",
    label: "نام خانوادگی",
    placeholder: "نام خانوادگی خود را وارد کنید",
  },
  {
    name: "nationalCode",
    label: "کد ملی",
    placeholder: "کد ملی ۱۰ رقمی",
    maxLength: 10,
  },
  {
    name: "birthDate",
    label: "تاریخ تولد",
    placeholder: "مثلاً ۱۳۸۲/۰۵/۳۰",
  },
  {
    name: "iban",
    label: "شماره شبا",
    placeholder: "IR را وارد کنید",
    maxLength: 26,
  },
  {
    name: "mobile",
    label: "شماره موبایل",
    placeholder: "09xxxxxxxxx",
    maxLength: 11,
  },
];

export default function IdentityStep({
  data,
  onChange,
  onNext,
}: IdentityStepProps) {
  const handleChange = (
    name: keyof IdentityFormData,
    value: string
  ) => {
    onChange({
      ...data,
      [name]: value,
    });
  };

  const isValid =
    data.firstName.trim() !== "" &&
    data.lastName.trim() !== "" &&
    /^\d{10}$/.test(data.nationalCode) &&
    data.birthDate.trim() !== "" &&
    /^IR\d{24}$/.test(data.iban) &&
    /^09\d{9}$/.test(data.mobile);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--vaka-text)]">
          اطلاعات هویتی
        </h2>
        <p className="mt-2 text-sm text-[var(--vaka-text-secondary)]">
          لطفاً اطلاعات خود را مطابق مدارک شناسایی وارد کنید.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <label
              htmlFor={field.name}
              className="block text-sm font-medium text-[var(--vaka-text)]"
            >
              {field.label}
            </label>

            <input
              id={field.name}
              name={field.name}
              type={field.type ?? "text"}
              value={data[field.name]}
              onChange={(event) =>
                handleChange(field.name, event.target.value)
              }
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              dir="rtl"
              className="w-full rounded-xl border border-[var(--vaka-border)] bg-white px-4 py-3 text-sm text-[var(--vaka-text)] outline-none transition focus:border-[var(--vaka-primary)] focus:ring-2 focus:ring-[var(--vaka-primary)]/10"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end border-t border-[var(--vaka-border-soft)] pt-5">
        <button
          type="button"
          onClick={onNext}
          disabled={!isValid}
          className="rounded-xl bg-[var(--vaka-primary)] px-7 py-3 text-sm font-medium text-white transition hover:bg-[var(--vaka-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ادامه
        </button>
      </div>
    </section>
  );
}