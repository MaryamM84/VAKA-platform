"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import OtpVerification from "@/components/auth/OtpVerification";
import {
  FieldError,
  SuccessIcon,
  inputClass,
  normalizePhone,
  validatePhone,
  type FieldStatus,
} from "@/components/ui/form-feedback";

type RegisterStep = "form" | "otp";

function validatePassword(value: string) {
  if (!value) return "رمز عبور الزامی است";
  if (value.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد";
  return "";
}

export default function RegisterPage() {
  const [step, setStep] = useState<RegisterStep>("form");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState({ phone: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");

  const phoneError = touched.phone ? validatePhone(phone) : "";
  const passwordError = touched.password ? validatePassword(password) : "";
  const termsError =
    submitted && !accepted
      ? "برای ادامه باید قوانین و شرایط استفاده را بپذیرید"
      : "";

  const phoneStatus: FieldStatus = phoneError
    ? "error"
    : touched.phone
    ? "success"
    : "default";
  const passwordStatus: FieldStatus = passwordError ? "error" : "default";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSubmitted(true);
    setTouched({ phone: true, password: true });

    if (validatePhone(phone) || validatePassword(password) || !accepted) return;

    // TODO: اتصال به API ثبت‌نام و ارسال کد تأیید
    // در صورت خطای سرور: setFormError("این شماره قبلاً ثبت‌نام کرده است");
    setOtpError("");
    setStep("otp");
  }

  async function handleVerifyOtp(code: string) {
    setOtpLoading(true);
    setOtpError("");
    try {
      // TODO: اتصال به API بررسی کد، و بعد redirect
      void code;
    } catch {
      setOtpError("کد واردشده نادرست است");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp() {
    // TODO: اتصال به API ارسال مجدد کد
    setOtpError("");
  }

  // مرحلهٔ وارد کردن کد تأیید (کامپوننت مشترک با لاگین)
  if (step === "otp") {
    return (
      <OtpVerification
        phone={phone}
        loading={otpLoading}
        error={otpError}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        onBack={() => setStep("form")}
      />
    );
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#eff8f5] px-4 py-6 text-[#17283b] sm:px-8"
    >
      <section className="grid w-full max-w-[900px] overflow-hidden rounded-[20px] bg-white shadow-[0_12px_30px_rgba(42,75,68,0.09)] md:grid-cols-[1fr_1.35fr]">
        {/* پنل تصویر: ستون اول در RTL = سمت راست */}
        <aside className="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#e9f3f0] to-[#dcebe6] px-5 py-8 md:min-h-[540px]">
          <span className="absolute right-8 top-8 h-14 w-14 rounded-full bg-[#cfe0da]/70 blur-xl" />

          <div className="relative z-10 flex flex-col items-center">
            <Image
              src="/images/main%20logo.png"
              alt="لوگوی واکا"
              width={120}
              height={120}
              priority
              className="h-auto w-20 object-contain"
            />

            <Image
              src="/images/Friendly_Package_Exchange-removebg-preview.png"
              alt="تبادل بسته بین دو نفر"
              width={480}
              height={360}
              priority
              className="mt-3 h-auto w-full max-w-[280px] object-contain md:max-w-[320px]"
            />

            <p className="mt-5 text-center text-sm font-extrabold text-[#263746]">
              با واکا، مهارت‌هات رو به اشتراک بگذار
            </p>
          </div>
        </aside>

        {/* فرم: ستون دوم = سمت چپ */}
        <div className="flex min-h-[500px] flex-col px-5 py-8 sm:px-8 sm:pt-10 lg:px-10">
          <h1 className="text-center text-[23px] font-extrabold tracking-tight sm:text-[26px]">
            به واکا خوش آمدید
          </h1>

          <p className="mt-2 text-center text-xs leading-6 text-[#77899d]">
            شماره همراه را وارد کرده و یک رمز عبور تعیین کنید.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {/* شماره موبایل */}
            <div>
              <label htmlFor="phone" className="mb-2 block text-right text-xs font-bold text-[#34485a]">
                شماره موبایل
              </label>

              <div className="relative">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={11}
                  value={phone}
                  onChange={(event) => setPhone(normalizePhone(event.target.value))}
                  onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                  aria-invalid={!!phoneError}
                  aria-describedby={phoneError ? "phone-error" : undefined}
                  placeholder="09123456789"
                  className={`${inputClass(phoneStatus)} pl-11 pr-[84px]`}
                />

                {/* پرچم و کد کشور (راست) */}
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-1.5 rounded-r-xl border-l border-[#d7e0e8] px-3 text-[11px] text-[#718198]">
                  <span dir="ltr">+۹۸</span>
                  <span className="flex h-3 w-[18px] flex-col overflow-hidden rounded-[2px] border border-black/10">
                    <span className="flex-1 bg-[#239f40]" />
                    <span className="flex-1 bg-white" />
                    <span className="flex-1 bg-[#da0000]" />
                  </span>
                </span>

                {/* آیکون تلفن یا تیک موفقیت (چپ) */}
                {phoneStatus === "success" ? (
                  <SuccessIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" />
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8498ac]"
                  >
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
                  </svg>
                )}
              </div>

              <FieldError id="phone-error" message={phoneError} />
            </div>

            {/* تعیین رمز عبور */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-bold text-[#34485a]">
                  تعیین رمز عبور
                </label>
                <span
                  className={`text-[10px] ${
                    passwordError ? "text-[#d64550]" : "text-[#98a9b9]"
                  }`}
                >
                  حداقل ۸ کاراکتر
                </span>
              </div>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  placeholder="رمز عبور دلخواه خود را بنویسید"
                  className={`${inputClass(passwordStatus)} pl-11 pr-4`}
                />

                {/* نمایش/مخفی‌کردن رمز (چپ) */}
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
                  aria-pressed={showPassword}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#8498ac] transition hover:text-[#08715f] focus:outline-none focus:ring-2 focus:ring-[#08715f]/30"
                >
                  {showPassword ? (
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.4 9.5 7-.4 1.1-1.2 2.2-2.2 3.2M6.2 6.2C3.8 7.7 2.5 10 2 12c1 2.6 4.5 7 10 7 1.1 0 2.1-.2 3-.5" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <FieldError id="password-error" message={passwordError} />
            </div>

            {/* قوانین و شرایط */}
            <div>
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#50657a]">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  aria-invalid={!!termsError}
                  className="h-4 w-4 rounded accent-[#08715f]"
                />
                <span>
                  <Link
                    href="/terms"
                    className="font-semibold text-[#08715f] hover:underline"
                  >
                    قوانین و شرایط استفاده
                  </Link>{" "}
                  را می‌پذیرم.
                </span>
              </label>

              <FieldError message={termsError} />
            </div>

            {/* خطای کلی فرم (مثلاً پاسخ سرور) */}
            <FieldError message={formError} />

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#075749] to-[#087763] py-3 text-sm font-bold text-white shadow-[0_5px_10px_rgba(0,90,73,0.15)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#08715f] focus:ring-offset-2"
            >
              ایجاد حساب و دریافت کد تأیید
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-[#8fa1b2]">
            <span className="h-px flex-1 bg-[#e2eaf0]" />
            یا
            <span className="h-px flex-1 bg-[#e2eaf0]" />
          </div>

          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#cfd9e2] bg-white py-3 text-xs text-[#50657a] transition hover:border-[#08715f] hover:bg-[#f4faf8]"
          >
            قبلاً ثبت‌نام کرده‌اید؟
            <span className="font-bold text-[#08715f]">ورود به حساب کاربری</span>
          </Link>
        </div>
      </section>
    </main>
  );
}