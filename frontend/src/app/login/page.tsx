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

type LoginMethod = "password" | "sms";
type LoginStep = "form" | "otp";

const validatePassword = (value: string) =>
  value ? "" : "رمز عبور الزامی است";

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>("form");
  const [method, setMethod] = useState<LoginMethod>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [touched, setTouched] = useState({ phone: false, password: false });
  const [formError, setFormError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");

  // خطاها از روی مقدارها محاسبه می‌شوند و بعد از blur یا ارسال فرم دیده می‌شوند
  const phoneError = touched.phone ? validatePhone(phone) : "";
  const passwordError =
    method === "password" && touched.password ? validatePassword(password) : "";

  const phoneStatus: FieldStatus = phoneError
    ? "error"
    : touched.phone
    ? "success"
    : "default";
  const passwordStatus: FieldStatus = passwordError ? "error" : "default";

  const tabClass = (active: boolean) =>
    `flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-semibold transition sm:text-[13px] ${
      active
        ? "bg-white text-[#08715f] shadow-[0_1px_4px_rgba(0,0,0,0.08)]"
        : "text-[#718198] hover:text-[#08715f]"
    }`;

  function changeMethod(next: LoginMethod) {
    setMethod(next);
    setFormError("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setTouched({ phone: true, password: true });

    if (validatePhone(phone)) return;
    if (method === "password" && validatePassword(password)) return;

    if (method === "sms") {
      // TODO: اتصال به API ارسال کد پیامکی
      setOtpError("");
      setStep("otp");
      return;
    }

    // TODO: اتصال به API ورود با رمز عبور
    // در صورت خطای سرور: setFormError("شماره موبایل یا رمز عبور اشتباه است");
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

  // مرحلهٔ وارد کردن کد تأیید
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
        {/* کارت شخصیت: ستون اول در RTL = سمت راست */}
        <aside className="relative flex min-h-[260px] flex-col items-center justify-between overflow-hidden bg-[#e8f1ef] px-5 pb-6 pt-8 md:min-h-[540px]">
          <span className="absolute right-8 top-8 h-14 w-14 rounded-full bg-[#d9e9e4]/70 blur-xl" />

          <div className="relative z-10 flex flex-1 items-center justify-center">
            <Image
              src="/images/Multitasking%20Parcel%20Delivery%20Character.png"
              alt="کاراکتر واکا با بسته و تلفن همراه"
              width={360}
              height={540}
              priority
              className="h-auto max-h-[290px] w-full max-w-[210px] object-contain md:max-h-[400px] md:max-w-[250px]"
            />
          </div>

          <p className="relative z-10 mt-3 text-center text-sm font-extrabold text-[#263746]">
            خوشحالیم که دوباره می‌بینیمت
          </p>
        </aside>

        {/* فرم: ستون دوم = سمت چپ */}
        <div className="flex min-h-[500px] flex-col px-5 py-7 sm:px-8 sm:py-8 lg:px-10">
          <h1 className="text-right text-[23px] font-extrabold tracking-tight sm:text-[26px]">
            ورود به حساب کاربری
          </h1>

          <p className="mt-2 text-right text-xs leading-6 text-[#77899d]">
            لطفاً روش ورود مورد نظر خود را جهت دسترسی به پنل کاربری انتخاب نمایید.
          </p>

          {/* انتخاب روش ورود: رمز عبور سمت راست */}
          <div className="mt-5 grid grid-cols-2 rounded-2xl bg-[#f0f4f8] p-1">
            <button
              type="button"
              onClick={() => changeMethod("password")}
              className={tabClass(method === "password")}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                <circle cx="12" cy="15" r="1" />
              </svg>
              ورود با رمز عبور
            </button>

            <button
              type="button"
              onClick={() => changeMethod("sms")}
              className={tabClass(method === "sms")}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
                <rect x="6.5" y="2.5" width="11" height="19" rx="2" />
                <path d="M10 5h4M11 18.5h2" />
              </svg>
              ورود با پیامک یک‌بارمصرف
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
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
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={11}
                  value={phone}
                  onChange={(event) => setPhone(normalizePhone(event.target.value))}
                  onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                  aria-invalid={!!phoneError}
                  aria-describedby={phoneError ? "phone-error" : undefined}
                  placeholder="09123456789"
                  className={`${inputClass(phoneStatus)} pl-[84px] pr-11 text-left`}
                />

                {/* پرچم و کد کشور (چپ) */}
                <span
                  dir="ltr"
                  className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-[11px] text-[#718198]"
                >
                  <span className="flex h-3 w-[18px] flex-col overflow-hidden rounded-[2px] border border-black/10">
                    <span className="flex-1 bg-[#239f40]" />
                    <span className="flex-1 bg-white" />
                    <span className="flex-1 bg-[#da0000]" />
                  </span>
                  +98
                </span>

                {/* آیکون تلفن یا تیک موفقیت (راست) */}
                {phoneStatus === "success" ? (
                  <SuccessIcon className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2" />
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8498ac]"
                  >
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
                  </svg>
                )}
              </div>

              <FieldError id="phone-error" message={phoneError} />
            </div>

            {/* رمز عبور */}
            {method === "password" && (
              <div>
                <label htmlFor="password" className="mb-2 block text-right text-xs font-bold text-[#34485a]">
                  رمز عبور
                </label>

                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? "password-error" : undefined}
                    placeholder="رمز عبور خود را وارد کنید"
                    className={`${inputClass(passwordStatus)} pl-12 pr-11`}
                  />

                  {/* آیکون کلید (راست) */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8498ac]"
                  >
                    <circle cx="8" cy="15" r="4" />
                    <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />
                  </svg>

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
            )}

            {method === "password" && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
                <label className="flex cursor-pointer items-center gap-2 text-[#50657a]">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-4 w-4 rounded accent-[#08715f]"
                  />
                  مرا به خاطر بسپار
                </label>

                <button
                  type="button"
                  onClick={() => changeMethod("sms")}
                  className="font-semibold text-[#08715f] hover:underline"
                >
                  رمز عبور را فراموش کرده‌اید؟
                </button>
              </div>
            )}

            {/* خطای کلی فرم (مثلاً پاسخ سرور) */}
            <FieldError message={formError} />

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#075749] to-[#087763] py-3 text-sm font-bold text-white shadow-[0_5px_10px_rgba(0,90,73,0.15)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[#08715f] focus:ring-offset-2"
            >
              {method === "password" ? "ورود به حساب کاربری" : "دریافت کد پیامکی"}
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-[#8fa1b2]">
            <span className="h-px flex-1 bg-[#e2eaf0]" />
            یا
            <span className="h-px flex-1 bg-[#e2eaf0]" />
          </div>

          <p className="text-center text-xs text-[#667b8c]">
            حساب کاربری ندارید؟{" "}
            <Link
              href="/register"
              className="inline-flex items-center gap-1 font-semibold text-[#f47752] hover:underline"
            >
              ثبت‌نام در واکا
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
            </Link>
          </p>

          {/* فوتر: SSL راست، قوانین چپ */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6 text-[10px] text-[#98a9b9]">
            <span className="flex items-center gap-1">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#08715f" strokeWidth="2" className="h-3 w-3">
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              رمزنگاری سراسری SSL ۲۵۶ بیتی
            </span>
            <Link href="/terms" className="hover:text-[#08715f]">
              قوانین و حریم خصوصی
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}