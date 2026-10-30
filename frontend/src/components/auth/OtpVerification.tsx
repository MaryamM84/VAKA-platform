"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FieldError, toEn } from "@/components/ui/form-feedback";

type OtpVerificationProps = {
  /** شماره موبایلی که کد برایش ارسال شده */
  phone: string;
  /** تعداد ارقام کد (پیش‌فرض ۵) */
  length?: number;
  /** زمان انتظار برای ارسال مجدد، به ثانیه (پیش‌فرض ۵۹) */
  resendSeconds?: number;
  loading?: boolean;
  /** پیام خطا، مثلاً «کد واردشده نادرست است» */
  error?: string;
  onVerify: (code: string) => void | Promise<void>;
  onResend: () => void | Promise<void>;
  /** برگشت به مرحلهٔ ثبت شماره (برای «ویرایش شماره» و «بازگشت») */
  onBack: () => void;
};

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

const toFa = (value: string) =>
  value.replace(/\d/g, (d) => FA_DIGITS[Number(d)]);

const formatTime = (total: number) => {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return toFa(`${m}:${s}`);
};

export default function OtpVerification({
  phone,
  length = 5,
  resendSeconds = 59,
  loading = false,
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

  // فوکوس روی اولین خانه هنگام نمایش
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // شمارندهٔ ارسال مجدد
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function focusInput(index: number) {
    inputsRef.current[index]?.focus();
    inputsRef.current[index]?.select();
  }

  // پر کردن خانه‌ها از یک اندیس به بعد (برای تایپ، paste و پر شدن خودکار)
  function fillFrom(start: number, digits: string) {
    const next = [...values];
    digits
      .slice(0, length - start)
      .split("")
      .forEach((digit, i) => {
        next[start + i] = digit;
      });
    setValues(next);
    focusInput(Math.min(start + digits.length, length - 1));
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
    }

    // خانهٔ اول سمت چپ است
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    }
    if (event.key === "ArrowRight" && index < length - 1) {
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
    if (secondsLeft > 0) return;
    await onResend();
    setValues(Array(length).fill(""));
    setSecondsLeft(resendSeconds);
    focusInput(0);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isComplete || loading) return;
    await onVerify(code);
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#eff8f5] px-4 py-6 text-[#17283b] sm:px-8"
    >
      <section className="grid w-full max-w-[900px] overflow-hidden rounded-[20px] bg-white shadow-[0_12px_30px_rgba(42,75,68,0.09)] md:grid-cols-[1fr_1.35fr]">
        {/* کارت شخصیت: سمت راست */}
        <aside className="relative flex min-h-[260px] flex-col items-center justify-between overflow-hidden bg-[#dfeae7] px-5 pb-6 pt-8 md:min-h-[540px]">
          <span className="absolute right-8 top-8 h-14 w-14 rounded-full bg-[#cfe0da]/70 blur-xl" />

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

          <p className="relative z-10 mt-3 text-center text-sm font-extrabold text-[#263746]">
            واکا مجموعه‌ای از فرصت‌های کوچک
          </p>
        </aside>

        {/* فرم: سمت چپ */}
        <div className="flex min-h-[500px] flex-col items-center justify-center px-5 py-7 sm:px-8 sm:py-8 lg:px-10">
          <div className="w-full max-w-[340px]">
            {/* آیکون موبایل */}
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#d3e5df] bg-[#e7f1ef] text-[#08715f]">
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

            <p className="mt-2 text-center text-xs leading-7 text-[#77899d]">
              کد {toFa(String(length))} رقمی ارسال‌شده به شماره{" "}
              <bdi
                dir="ltr"
                className="rounded-md bg-[#eef3f6] px-1.5 py-0.5 font-bold text-[#34485a]"
              >
                {toFa(phone)}
              </bdi>{" "}
              را وارد نمایید.{" "}
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 font-semibold text-[#f47752] hover:underline"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-3 w-3"
                >
                  <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
                </svg>
                ویرایش شماره
              </button>
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-7">
              {/* خانه‌های کد: خانهٔ اول سمت چپ */}
              <div dir="ltr" className="flex justify-center gap-2.5 sm:gap-3">
                {values.map((value, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputsRef.current[index] = el;
                    }}
                    value={value}
                    onChange={(event) => handleChange(index, event.target.value)}
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    onPaste={(event) => handlePaste(index, event)}
                    onFocus={(event) => event.target.select()}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={length}
                    aria-label={`رقم ${toFa(String(index + 1))} کد تأیید`}
                    aria-invalid={!!error}
                    className={`h-12 w-12 rounded-xl border-[1.5px] text-center text-lg font-bold outline-none transition sm:h-14 sm:w-14 ${
                      error
                        ? "border-[#e5707a] bg-[#fff6f6] text-[#c8404b] focus:ring-4 focus:ring-[#e5707a]/15"
                        : value
                        ? "border-[#16866f] bg-white text-[#263746] focus:ring-4 focus:ring-[#16866f]/10"
                        : "border-[#cfdad6] bg-white text-[#263746] focus:border-[#16866f] focus:ring-4 focus:ring-[#16866f]/10"
                    }`}
                  />
                ))}
              </div>

              <FieldError message={error} />

              {/* شمارندهٔ ارسال مجدد */}
              <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-[#718198]">
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
                    <span className="font-bold text-[#08715f]">
                      {formatTime(secondsLeft)}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="font-semibold text-[#08715f] hover:underline"
                  >
                    ارسال مجدد کد
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!isComplete || loading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#075749] to-[#087763] py-3 text-sm font-bold text-white shadow-[0_5px_10px_rgba(0,90,73,0.15)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#08715f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
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
              className="mx-auto mt-5 flex items-center gap-1.5 text-[11px] text-[#718198] transition hover:text-[#08715f]"
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