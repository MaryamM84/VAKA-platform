"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FieldError, toEn, toFa } from "@/components/ui/form-feedback";

type OtpVerificationProps = {
  /** شماره موبایلی که کد برایش ارسال شده است. */
  phone: string;
  /** تعداد ارقام کد مطابق مستندات API (۵ رقم). */
  length?: number;
  /** مدت انتظار ارسال مجدد به ثانیه. */
  resendSeconds?: number;
  loading?: boolean;
  resendLoading?: boolean;
  error?: string;
  onVerify: (code: string) => void | Promise<void>;
  /** با false اعلام می‌کند ارسال مجدد موفق نبوده و شمارنده نباید ریست شود. */
  onResend: () => boolean | void | Promise<boolean | void>;
  onBack: () => void;
};

const formatTime = (total: number) => {
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return toFa(`${minutes}:${seconds}`);
};

export default function OtpVerification({
  phone,
  length = 5,
  resendSeconds = 59,
  loading = false,
  resendLoading = false,
  error,
  onVerify,
  onResend,
  onBack,
}: OtpVerificationProps) {
  const [values, setValues] = useState<string[]>(() => Array(length).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(resendSeconds);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const code = values.join("");
  const isComplete = code.length === length;
  const isBusy = loading || resendLoading;

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  function focusInput(index: number) {
    inputsRef.current[index]?.focus();
    inputsRef.current[index]?.select();
  }

  function fillFrom(start: number, digits: string) {
    const availableDigits = digits.slice(0, length - start).split("");
    const next = [...values];
    availableDigits.forEach((digit, offset) => {
      next[start + offset] = digit;
    });
    setValues(next);
    focusInput(Math.min(start + availableDigits.length, length - 1));
  }

  function handleChange(index: number, raw: string) {
    const digits = toEn(raw).replace(/\D/g, "");

    if (!digits) {
      const next = [...values];
      next[index] = "";
      setValues(next);
      return;
    }

    fillFrom(index, digits);
  }

  function handleKeyDown(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Backspace" && !values[index] && index > 0) {
      event.preventDefault();
      const next = [...values];
      next[index - 1] = "";
      setValues(next);
      focusInput(index - 1);
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  }

  function handlePaste(
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>
  ) {
    event.preventDefault();
    const digits = toEn(event.clipboardData.getData("text")).replace(/\D/g, "");
    if (digits) fillFrom(index, digits);
  }

  async function handleResend() {
    if (secondsLeft > 0 || isBusy) return;
    const result = await onResend();
    if (result === false) return;

    setValues(Array(length).fill(""));
    setSecondsLeft(resendSeconds);
    focusInput(0);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isComplete || isBusy) return;
    await onVerify(code);
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[var(--vaka-auth-page)] px-4 py-6 text-[var(--vaka-auth-text)] sm:px-8"
    >
      <section className="grid w-full max-w-[900px] overflow-hidden rounded-[20px] bg-[var(--vaka-auth-surface)] shadow-[var(--vaka-auth-card-shadow)] md:grid-cols-[1fr_1.35fr]">
        <aside className="relative flex min-h-[260px] flex-col items-center justify-between overflow-hidden bg-[var(--vaka-auth-panel-alt)] px-5 pb-6 pt-8 md:min-h-[540px]">
          <span className="absolute right-8 top-8 h-14 w-14 rounded-full bg-[var(--vaka-auth-panel-glow)] blur-xl" />

          <div className="relative z-10 flex flex-1 items-center justify-center">
            <Image
              src="/images/Woman%20Tapping%20Smartphone%20with%20Tote%20Bag.png"
              alt="کاراکتر واکا با تلفن همراه و کیف"
              width={360}
              height={540}
              priority
              className="h-auto max-h-[290px] w-full max-w-[210px] object-contain md:max-h-[400px] md:max-w-[250px]"
            />
          </div>

          <p className="relative z-10 mt-3 text-center text-sm font-extrabold text-[var(--vaka-auth-heading)]">
            واکا مجموعه‌ای از فرصت‌های کوچک
          </p>
        </aside>

        <div className="flex min-h-[500px] flex-col items-center justify-center px-5 py-7 sm:px-8 sm:py-8 lg:px-10">
          <div className="w-full max-w-[340px]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--vaka-auth-primary-border)] bg-[var(--vaka-auth-primary-soft)] text-[var(--vaka-auth-primary)]">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <rect x="6.5" y="2.5" width="11" height="19" rx="2" />
                <path d="M10 5h4M11 18.5h2" />
              </svg>
            </div>

            <h1 className="mt-4 text-center text-[23px] font-extrabold tracking-tight sm:text-[26px]">
              کد تأیید را وارد کنید
            </h1>

            <p className="mt-2 text-center text-xs leading-7 text-[var(--vaka-auth-muted)]">
              کد {toFa(String(length))} رقمی ارسال‌شده به شماره{" "}
              <bdi
                dir="ltr"
                className="rounded-md bg-[var(--vaka-auth-code-bg)] px-1.5 py-0.5 font-bold text-[var(--vaka-auth-label)]"
              >
                {toFa(phone)}
              </bdi>{" "}
              را وارد نمایید.{" "}
              <button
                type="button"
                onClick={onBack}
                disabled={isBusy}
                className="inline-flex items-center gap-1 font-semibold text-[var(--vaka-auth-orange)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                ویرایش شماره
              </button>
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-7">
              <div dir="ltr" className="flex justify-center gap-2.5 sm:gap-3">
                {values.map((value, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputsRef.current[index] = element;
                    }}
                    value={toFa(value)}
                    onChange={(event) => handleChange(index, event.target.value)}
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    onPaste={(event) => handlePaste(index, event)}
                    onFocus={(event) => event.target.select()}
                    type="text"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={index === 0 ? length : 1}
                    disabled={isBusy}
                    aria-label={`رقم ${toFa(String(index + 1))} کد تأیید`}
                    aria-invalid={Boolean(error)}
                    className={`h-12 w-12 rounded-xl border-[1.5px] bg-[var(--vaka-auth-surface)] text-center text-lg font-bold text-[var(--vaka-auth-heading)] outline-none transition focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:w-14 ${
                      error
                        ? "border-[var(--vaka-auth-error-border)] bg-[var(--vaka-auth-error-bg)] focus:ring-[var(--vaka-auth-error)]/15"
                        : value
                          ? "border-[var(--vaka-auth-primary)] focus:ring-[var(--vaka-auth-primary)]/10"
                          : "border-[var(--vaka-auth-input-border)] focus:border-[var(--vaka-auth-primary)] focus:ring-[var(--vaka-auth-primary)]/10"
                    }`}
                  />
                ))}
              </div>

              <FieldError message={error} />

              <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-[var(--vaka-auth-subtle)]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-3.5 w-3.5"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>

                {secondsLeft > 0 ? (
                  <span>
                    امکان ارسال مجدد کد پس از{" "}
                    <span className="font-bold text-[var(--vaka-auth-primary)]">
                      {formatTime(secondsLeft)}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isBusy}
                    className="font-semibold text-[var(--vaka-auth-primary)] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resendLoading ? "در حال ارسال..." : "ارسال مجدد کد"}
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!isComplete || isBusy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[var(--vaka-auth-primary-dark)] to-[var(--vaka-auth-primary-hover)] py-3 text-sm font-bold text-[var(--vaka-auth-on-primary)] shadow-[var(--vaka-auth-button-shadow)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[var(--vaka-auth-primary)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
              >
                {loading ? "در حال بررسی..." : "تأیید و ادامه"}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path d="M19 12H5M11 6l-6 6 6 6" />
                </svg>
              </button>
            </form>

            <button
              type="button"
              onClick={onBack}
              disabled={isBusy}
              className="mx-auto mt-5 flex items-center gap-1.5 text-[11px] text-[var(--vaka-auth-subtle)] transition hover:text-[var(--vaka-auth-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              بازگشت به مرحله ثبت شماره
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-3 w-3"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
