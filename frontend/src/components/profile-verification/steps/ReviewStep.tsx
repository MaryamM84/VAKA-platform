"use client";

import type { IdentityFormData, VerificationDocuments } from "../types";

interface ReviewStepProps {
  identity: IdentityFormData;
  documents: VerificationDocuments;
  hasUploadedFront?: boolean;
  hasUploadedBack?: boolean;
  onBack: () => void;
  onEditIdentity: () => void;
  onEditDocuments: () => void;
  onSubmit: () => void;
  isConfirmed: boolean;
  onConfirmChange: (checked: boolean) => void;
  isPreparing: boolean;
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-[var(--vaka-bg)] p-4">
      <span className="text-xs text-[var(--vaka-text-muted)]">{label}</span>
      <span className="break-words text-sm font-medium text-[var(--vaka-text)]">{value || "وارد نشده"}</span>
    </div>
  );
}

function SectionHeading({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-semibold text-[var(--vaka-text)]">{title}</h3>
      <button type="button" onClick={onEdit} className="text-xs font-semibold text-[var(--vaka-primary)] hover:underline">ویرایش</button>
    </div>
  );
}

export default function ReviewStep({
  identity,
  documents,
  hasUploadedFront = false,
  hasUploadedBack = false,
  onBack,
  onEditIdentity,
  onEditDocuments,
  onSubmit,
  isConfirmed,
  onConfirmChange,
  isPreparing,
}: ReviewStepProps) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--vaka-text)]">بازبینی اطلاعات</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--vaka-text-secondary)]">پیش از ثبت درخواست، همه اطلاعات و تصاویر را با دقت بررسی کنید.</p>
      </div>

      <div className="space-y-4">
        <SectionHeading title="اطلاعات هویتی" onEdit={onEditIdentity} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReviewItem label="نام" value={identity.firstName} />
          <ReviewItem label="نام خانوادگی" value={identity.lastName} />
          <ReviewItem label="کد ملی" value={identity.nationalCode} />
          <ReviewItem label="تاریخ تولد شمسی" value={identity.birthDate} />
          <ReviewItem label="شماره شبا" value={identity.iban} />
          <ReviewItem label="شماره موبایل" value={identity.mobile} />
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeading title="مدارک بارگذاری‌شده" onEdit={onEditDocuments} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReviewItem label="روی کارت ملی" value={documents.nationalCardFront?.name ?? (hasUploadedFront ? "قبلاً بارگذاری شده" : "")} />
          <ReviewItem label="پشت کارت ملی" value={documents.nationalCardBack?.name ?? (hasUploadedBack ? "قبلاً بارگذاری شده" : "")} />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-primary-pale)] p-4">
        <label htmlFor="verification-confirmation" className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" id="verification-confirmation" checked={isConfirmed} onChange={(event) => onConfirmChange(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--vaka-primary)]" />
          <span className="text-sm leading-7 text-[var(--vaka-text)]">صحت اطلاعات واردشده و تعلق مدارک بارگذاری‌شده به خودم را تأیید می‌کنم.</span>
        </label>
      </div>

      <div className="flex justify-between border-t border-[var(--vaka-border-soft)] pt-5">
        <button type="button" onClick={onBack} className="rounded-xl border border-[var(--vaka-border)] px-6 py-3 text-sm font-medium text-[var(--vaka-text)] transition hover:bg-[var(--vaka-bg)]">مرحله قبل</button>
        <button type="button" onClick={onSubmit} disabled={!isConfirmed || isPreparing} className="rounded-xl bg-[var(--vaka-primary)] px-7 py-3 text-sm font-medium text-white transition hover:bg-[var(--vaka-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">{isPreparing ? "در حال آماده‌سازی..." : "تکمیل و آماده‌سازی درخواست"}</button>
      </div>
    </section>
  );
}
