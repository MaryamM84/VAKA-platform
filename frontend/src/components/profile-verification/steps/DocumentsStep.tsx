"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { VerificationDocuments } from "../types";

interface DocumentsStepProps {
  data: VerificationDocuments;
  onChange: (data: VerificationDocuments) => void;
  onNext: () => void;
  onBack: () => void;
  hasUploadedFront?: boolean;
  hasUploadedBack?: boolean;
}

interface UploadFieldProps {
  title: string;
  description: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function UploadField({ title, description, file, onFileChange }: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) return;
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError("فرمت فایل باید JPG، PNG یا WEBP باشد.");
      event.target.value = "";
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("حجم تصویر نباید بیشتر از ۵ مگابایت باشد.");
      event.target.value = "";
      return;
    }
    setError("");
    onFileChange(selectedFile);
  };

  return (
    <div className="rounded-2xl border border-[var(--vaka-border)] bg-white p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-[var(--vaka-text)]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--vaka-text-secondary)]">{description}</p>
      </div>

      {file && previewUrl ? (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-bg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={`پیش‌نمایش ${title}`} className="h-44 w-full object-contain" />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--vaka-primary-pale)] p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--vaka-text)]">{file.name}</p>
              <p className="mt-1 text-xs text-[var(--vaka-text-secondary)]">{(file.size / 1024 / 1024).toFixed(2)} مگابایت</p>
            </div>
            <div className="flex shrink-0 gap-3">
              <button type="button" onClick={() => inputRef.current?.click()} className="text-xs font-semibold text-[var(--vaka-primary)]">جایگزینی</button>
              <button type="button" onClick={() => { onFileChange(null); if (inputRef.current) inputRef.current.value = ""; }} className="text-xs font-semibold text-[var(--vaka-danger)]">حذف</button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--vaka-border)] bg-[var(--vaka-bg)] px-4 py-6 text-center transition hover:border-[var(--vaka-primary)] hover:bg-[var(--vaka-primary-pale)]">
          <span aria-hidden="true" className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--vaka-primary-soft)] text-xl text-[var(--vaka-primary)]">↑</span>
          <span className="text-sm font-semibold text-[var(--vaka-text)]">انتخاب تصویر</span>
          <span className="mt-1 text-xs text-[var(--vaka-text-muted)]">JPG، PNG یا WEBP — حداکثر ۵ مگابایت</span>
        </button>
      )}

      {error && <p role="alert" className="mt-3 text-xs text-[var(--vaka-danger)]">{error}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
    </div>
  );
}

export default function DocumentsStep({
  data,
  onChange,
  onNext,
  onBack,
  hasUploadedFront = false,
  hasUploadedBack = false,
}: DocumentsStepProps) {
  const isValid = Boolean((data.nationalCardFront || hasUploadedFront) && (data.nationalCardBack || hasUploadedBack));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--vaka-text)]">بارگذاری مدارک</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--vaka-text-secondary)]">تصویر هر دو سمت کارت ملی را با کیفیت مناسب و بدون برش اطلاعات بارگذاری کنید.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {data.nationalCardFront || !hasUploadedFront ? (
          <UploadField title="روی کارت ملی" description="سمت دارای عکس و مشخصات هویتی" file={data.nationalCardFront} onFileChange={(file) => onChange({ ...data, nationalCardFront: file })} />
        ) : (
          <div className="rounded-2xl border border-[var(--vaka-success)]/30 bg-[var(--vaka-success)]/5 p-5">
            <h3 className="font-semibold text-[var(--vaka-text)]">روی کارت ملی</h3>
            <p className="mt-3 text-sm text-[var(--vaka-success)]">این مدرک قبلاً در سرور بارگذاری شده است.</p>
          </div>
        )}
        {data.nationalCardBack || !hasUploadedBack ? (
          <UploadField title="پشت کارت ملی" description="تصویر کامل پشت کارت ملی" file={data.nationalCardBack} onFileChange={(file) => onChange({ ...data, nationalCardBack: file })} />
        ) : (
          <div className="rounded-2xl border border-[var(--vaka-success)]/30 bg-[var(--vaka-success)]/5 p-5">
            <h3 className="font-semibold text-[var(--vaka-text)]">پشت کارت ملی</h3>
            <p className="mt-3 text-sm text-[var(--vaka-success)]">این مدرک قبلاً در سرور بارگذاری شده است.</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-primary-pale)] p-4">
        <p className="mb-2 text-sm font-semibold text-[var(--vaka-primary)]">برای جلوگیری از رد شدن مدرک:</p>
        <ul className="list-inside list-disc space-y-1 text-xs leading-6 text-[var(--vaka-text-secondary)]">
          <li>تمام گوشه‌های کارت داخل تصویر باشند.</li>
          <li>متن‌ها و تصویر واضح و خوانا باشند.</li>
          <li>از نور مستقیم، انعکاس و تار بودن تصویر جلوگیری کنید.</li>
          <li>تصویر متعلق به خودتان باشد.</li>
        </ul>
      </div>

      <div className="flex justify-between border-t border-[var(--vaka-border-soft)] pt-5">
        <button type="button" onClick={onBack} className="rounded-xl border border-[var(--vaka-border)] px-6 py-3 text-sm font-medium text-[var(--vaka-text)] transition hover:bg-[var(--vaka-bg)]">مرحله قبل</button>
        <button type="button" onClick={onNext} disabled={!isValid} className="rounded-xl bg-[var(--vaka-primary)] px-7 py-3 text-sm font-medium text-white transition hover:bg-[var(--vaka-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">ادامه</button>
      </div>
    </section>
  );
}
