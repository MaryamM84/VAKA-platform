
"use client";

import type {
  IdentityFormData,
  VerificationDocuments,
} from "../types";

interface ReviewStepProps {
  identity: IdentityFormData;
  documents: VerificationDocuments;
  onBack: () => void;
  onSubmit: () => void;
  isConfirmed: boolean;
  onConfirmChange: (checked: boolean) => void;
}

function ReviewItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-[var(--vaka-bg)] p-4">
      <span className="text-xs text-[var(--vaka-text-muted)]">
        {label}
      </span>

      <span className="break-words text-sm font-medium text-[var(--vaka-text)]">
        {value || "وارد نشده"}
      </span>
    </div>
  );
}

export default function ReviewStep({
  identity,
  documents,
  onBack,
  onSubmit,
  isConfirmed,
  onConfirmChange,
}: ReviewStepProps) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--vaka-text)]">
          بازبینی اطلاعات
        </h2>

        <p className="mt-2 text-sm text-[var(--vaka-text-secondary)]">
          لطفاً اطلاعات واردشده و مدارک انتخابی را بررسی کنید.
        </p>
      </div>

      {/* Identity Information */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--vaka-text)]">
            اطلاعات هویتی
          </h3>

          <span className="text-xs text-[var(--vaka-success)]">
            مرحله اول تکمیل شده
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReviewItem
            label="نام"
            value={identity.firstName}
          />

          <ReviewItem
            label="نام خانوادگی"
            value={identity.lastName}
          />

          <ReviewItem
            label="کد ملی"
            value={identity.nationalCode}
          />

          <ReviewItem
            label="تاریخ تولد"
            value={identity.birthDate}
          />

          <ReviewItem
            label="شماره شبا"
            value={identity.iban}
          />

          <ReviewItem
            label="شماره موبایل"
            value={identity.mobile}
          />
        </div>
      </div>

      {/* Uploaded Documents */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--vaka-text)]">
            مدارک بارگذاری‌شده
          </h3>

          <span className="text-xs text-[var(--vaka-success)]">
            مرحله دوم تکمیل شده
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReviewItem
            label="روی کارت ملی"
            value={documents.nationalCardFront?.name ?? ""}
          />

          <ReviewItem
            label="پشت کارت ملی"
            value={documents.nationalCardBack?.name ?? ""}
          />
        </div>
      </div>

      {/* Confirmation */}
      <div className="rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-primary-pale)] p-4">
        <label
          htmlFor="verification-confirmation"
          className="flex cursor-pointer items-start gap-3"
        >
          <input
            type="checkbox"
            id="verification-confirmation"
            checked={isConfirmed}
            onChange={(event) =>
              onConfirmChange(event.target.checked)
            }
            className="mt-1 accent-[var(--vaka-primary)]"
          />

          <span className="text-sm leading-7 text-[var(--vaka-text)]">
            صحت اطلاعات واردشده و تعلق مدارک بارگذاری‌شده به خودم را
            تأیید می‌کنم.
          </span>
        </label>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between border-t border-[var(--vaka-border-soft)] pt-5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-[var(--vaka-border)] px-6 py-3 text-sm font-medium text-[var(--vaka-text)] transition hover:bg-[var(--vaka-bg)]"
        >
          مرحله قبل
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!isConfirmed}
          className="rounded-xl bg-[var(--vaka-primary)] px-7 py-3 text-sm font-medium text-white transition hover:bg-[var(--vaka-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ثبت درخواست احراز هویت
        </button>
      </div>
    </section>
  );
}
