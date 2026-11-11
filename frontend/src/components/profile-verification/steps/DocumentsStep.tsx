
"use client";

import { useRef } from "react";
import type { VerificationDocuments } from "../types";

interface DocumentsStepProps {
  data: VerificationDocuments;
  onChange: (data: VerificationDocuments) => void;
  onNext: () => void;
  onBack: () => void;
}

interface UploadFieldProps {
  title: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

function UploadField({
  title,
  description,
  file,
  onFileChange,
}: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;

    if (!allowedTypes.includes(selectedFile.type)) {
      alert("فرمت فایل باید JPG، PNG یا WEBP باشد.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > maxSize) {
      alert("حجم فایل نباید بیشتر از ۵ مگابایت باشد.");
      event.target.value = "";
      return;
    }

    onFileChange(selectedFile);
  };

  return (
    <div className="rounded-2xl border border-[var(--vaka-border)] bg-white p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-[var(--vaka-text)]">
          {title}
        </h3>
        <p className="mt-1 text-sm text-[var(--vaka-text-secondary)]">
          {description}
        </p>
      </div>

      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--vaka-primary-pale)] p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--vaka-text)]">
              {file.name}
            </p>
            <p className="mt-1 text-xs text-[var(--vaka-text-secondary)]">
              {(file.size / 1024 / 1024).toFixed(2)} مگابایت
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onFileChange(null);
              if (inputRef.current) {
                inputRef.current.value = "";
              }
            }}
            className="shrink-0 text-sm font-medium text-[var(--vaka-danger)]"
          >
            حذف فایل
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--vaka-border)] bg-[var(--vaka-bg)] px-4 py-6 text-center transition hover:border-[var(--vaka-primary)]"
        >
          <span className="mb-2 text-2xl text-[var(--vaka-primary)]">
            ↑
          </span>
          <span className="text-sm font-medium text-[var(--vaka-text)]">
            انتخاب تصویر
          </span>
          <span className="mt-1 text-xs text-[var(--vaka-text-muted)]">
            JPG، PNG یا WEBP — حداکثر ۵ مگابایت
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

export default function DocumentsStep({
  data,
  onChange,
  onNext,
  onBack,
}: DocumentsStepProps) {
  const isValid =
    data.nationalCardFront !== null &&
    data.nationalCardBack !== null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--vaka-text)]">
          بارگذاری مدارک
        </h2>
        <p className="mt-2 text-sm text-[var(--vaka-text-secondary)]">
          لطفاً تصاویر واضح و خوانا از هر دو سمت کارت ملی خود بارگذاری کنید.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <UploadField
          title="روی کارت ملی"
          description="تصویر سمت دارای عکس و مشخصات"
          file={data.nationalCardFront}
          onFileChange={(file) =>
            onChange({
              ...data,
              nationalCardFront: file,
            })
          }
        />

        <UploadField
          title="پشت کارت ملی"
          description="تصویر پشت کارت ملی"
          file={data.nationalCardBack}
          onFileChange={(file) =>
            onChange({
              ...data,
              nationalCardBack: file,
            })
          }
        />
      </div>

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
