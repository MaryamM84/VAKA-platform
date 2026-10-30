"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import OtpVerification from "@/components/auth/OtpVerification";
import {
  FieldError,
  SuccessIcon,
  inputClass,
  normalizePhone,
  toFa,
  validatePhone,
  type FieldStatus,
} from "@/components/ui/form-feedback";
import {
  getAuthRedirectPath,
  registerWithPassword,
  resendOtp,
  saveAuthSession,
  verifyRegistrationOtp,
} from "@/lib/auth-api";

type RegisterStep = "form" | "otp";

function validatePassword(value: string) {
  if (!value) return "رمز عبور الزامی است";
  if (value.length < 8) return "رمز عبور باید حداقل ۸ کاراکتر باشد";
  return "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "در انجام درخواست خطایی رخ داد. دوباره تلاش کنید.";
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<RegisterStep>("form");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState({
    phone: false,
    password: false,
    passwordConfirm: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [otpError, setOtpError] = useState("");

  const phoneError = touched.phone ? validatePhone(phone) : "";
  const passwordError = touched.password ? validatePassword(password) : "";
  const passwordConfirmError = touched.passwordConfirm
    ? !passwordConfirm
      ? "تکرار رمز عبور الزامی است"
      : passwordConfirm !== password
        ? "تکرار رمز عبور با رمز عبور یکسان نیست"
        : ""
    : "";
  const termsError = submitted && !accepted
    ? "برای ادامه باید قوانین و شرایط استفاده را بپذیرید."
    : "";

  const phoneStatus: FieldStatus = phoneError
    ? "error"
    : touched.phone && phone.length === 11
      ? "success"
      : "default";
  const passwordStatus: FieldStatus = passwordError ? "error" : "default";
  const passwordConfirmStatus: FieldStatus = passwordConfirmError ? "error" : "default";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSubmitted(true);
    setTouched({ phone: true, password: true, passwordConfirm: true });

    if (
      validatePhone(phone) ||
      validatePassword(password) ||
      !passwordConfirm ||
      passwordConfirm !== password ||
      !accepted
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerWithPassword(phone, password, passwordConfirm);
      if (!result?.requires_verification) {
        throw new Error(
          result?.detail ||
            "ثبت‌نام انجام شد، اما سرور فرایند تأیید شماره را فعال نکرده است. وضعیت API را بررسی کنید."
        );
      }

      setOtpError("");
      setStep("otp");
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(code: string) {
    setOtpLoading(true);
    setOtpError("");
    try {
      const auth = await verifyRegistrationOtp({ phone, code });
      saveAuthSession(auth, false);
      router.replace(getAuthRedirectPath());
    } catch (error) {
      setOtpError(getErrorMessage(error));
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendOtp(): Promise<boolean> {
    setResendLoading(true);
    setOtpError("");
    try {
      await resendOtp(phone, "REGISTER");
      return true;
    } catch (error) {
      setOtpError(getErrorMessage(error));
      return false;
    } finally {
      setResendLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <OtpVerification
        phone={phone}
        length={5}
        loading={otpLoading}
        resendLoading={resendLoading}
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
      className="flex min-h-screen items-center justify-center bg-[var(--vaka-auth-page)] px-4 py-6 text-[var(--vaka-auth-text)] sm:px-8"
    >
      <section className="grid w-full max-w-[900px] overflow-hidden rounded-[20px] bg-[var(--vaka-auth-surface)] shadow-[var(--vaka-auth-card-shadow)] md:grid-cols-[1fr_1.35fr]">
        <aside className="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[var(--vaka-auth-panel)] to-[var(--vaka-auth-panel-alt)] px-5 py-8 md:min-h-[540px]">
          <span className="absolute right-8 top-8 h-14 w-14 rounded-full bg-[var(--vaka-auth-panel-glow)] blur-xl" />

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

            <p className="mt-5 text-center text-sm font-extrabold text-[var(--vaka-auth-heading)]">
              با واکا، مهارت‌هات رو به اشتراک بگذار
            </p>
          </div>
        </aside>

        <div className="flex min-h-[500px] flex-col px-5 py-8 sm:px-8 sm:pt-10 lg:px-10">
          <h1 className="text-center text-[23px] font-extrabold tracking-tight sm:text-[26px]">
            به واکا خوش آمدید
          </h1>

          <p className="mt-2 text-center text-xs leading-6 text-[var(--vaka-auth-muted)]">
            شماره همراه را وارد کرده و یک رمز عبور تعیین کنید.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="register-phone" className="mb-2 block text-right text-xs font-bold text-[var(--vaka-auth-label)]">
                شماره موبایل
              </label>

              <div className="relative">
                <input
                  id="register-phone"
                  name="phone"
                  type="tel"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={11}
                  value={toFa(phone)}
                  onChange={(event) => setPhone(normalizePhone(event.target.value))}
                  onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? "register-phone-error" : undefined}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className={`${inputClass(phoneStatus)} pl-[84px] pr-11 text-left`}
                />

                {/* کد کشور در سمت چپ و شماره موبایل در سمت راست آن */}
                <span
                  dir="ltr"
                  className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-[11px] text-[var(--vaka-auth-subtle)]"
                >
                  <span className="flex h-3 w-[18px] flex-col overflow-hidden rounded-[2px] border border-black/10">
                    <span className="flex-1 bg-[#239f40]" />
                    <span className="flex-1 bg-white" />
                    <span className="flex-1 bg-[#da0000]" />
                  </span>
                  +۹۸
                </span>

                {phoneStatus === "success" ? (
                  <SuccessIcon className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2" />
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--vaka-auth-icon)]"
                  >
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
                  </svg>
                )}
              </div>
              <FieldError id="register-phone-error" message={phoneError} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="register-password" className="text-xs font-bold text-[var(--vaka-auth-label)]">
                  تعیین رمز عبور
                </label>
                <span className={`text-[10px] ${passwordError ? "text-[var(--vaka-auth-error-soft-text)]" : "text-[var(--vaka-auth-footer)]"}`}>
                  حداقل ۸ کاراکتر
                </span>
              </div>

              <div className="relative">
                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? "register-password-error" : undefined}
                  placeholder="رمز عبور دلخواه خود را بنویسید"
                  className={`${inputClass(passwordStatus)} pl-11 pr-4`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
                  aria-pressed={showPassword}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--vaka-auth-icon)] transition hover:text-[var(--vaka-auth-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--vaka-auth-primary)]/30"
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
              <FieldError id="register-password-error" message={passwordError} />
            </div>

            <div>
              <label htmlFor="register-password-confirm" className="mb-2 block text-right text-xs font-bold text-[var(--vaka-auth-label)]">
                تکرار رمز عبور
              </label>
              <div className="relative">
                <input
                  id="register-password-confirm"
                  name="password_confirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, passwordConfirm: true }))}
                  aria-invalid={Boolean(passwordConfirmError)}
                  aria-describedby={passwordConfirmError ? "register-password-confirm-error" : undefined}
                  placeholder="رمز عبور را دوباره وارد کنید"
                  className={`${inputClass(passwordConfirmStatus)} pl-11 pr-4`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm((current) => !current)}
                  aria-label={showPasswordConfirm ? "مخفی کردن تکرار رمز عبور" : "نمایش تکرار رمز عبور"}
                  aria-pressed={showPasswordConfirm}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--vaka-auth-icon)] transition hover:text-[var(--vaka-auth-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--vaka-auth-primary)]/30"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
                    {showPasswordConfirm ? (
                      <>
                        <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.4 9.5 7M6.2 6.2C3.8 7.7 2.5 10 2 12c1 2.6 4.5 7 10 7" />
                      </>
                    ) : (
                      <>
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
              <FieldError id="register-password-confirm-error" message={passwordConfirmError} />
            </div>

            <div>
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--vaka-auth-copy)]">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  aria-invalid={Boolean(termsError)}
                  className="h-4 w-4 rounded accent-[var(--vaka-auth-primary)]"
                />
                <span>
                  <Link href="/terms" className="font-semibold text-[var(--vaka-auth-primary)] hover:underline">
                    قوانین و شرایط استفاده
                  </Link>{" "}
                  را می‌پذیرم.
                </span>
              </label>
              <FieldError message={termsError} />
              {!accepted && <p className="mt-1 text-[10px] text-[var(--vaka-auth-muted)]">برای فعال شدن دکمه، پذیرش قوانین را علامت بزنید.</p>}
            </div>

            <FieldError message={formError} />

            <button
              type="submit"
              disabled={isSubmitting || !accepted}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[var(--vaka-auth-primary-dark)] to-[var(--vaka-auth-primary-hover)] py-3 text-sm font-bold text-[var(--vaka-auth-on-primary)] shadow-[var(--vaka-auth-button-shadow)] transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[var(--vaka-auth-primary)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
            >
              {isSubmitting ? "در حال ثبت‌نام..." : "ایجاد حساب و دریافت کد تأیید"}
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-[var(--vaka-auth-footer)]">
            <span className="h-px flex-1 bg-[var(--vaka-auth-divider)]" />
            یا
            <span className="h-px flex-1 bg-[var(--vaka-auth-divider)]" />
          </div>

          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--vaka-auth-link-border)] bg-[var(--vaka-auth-surface)] py-3 text-xs text-[var(--vaka-auth-copy)] transition hover:border-[var(--vaka-auth-primary)] hover:bg-[var(--vaka-auth-link-hover-bg)]"
          >
            قبلاً ثبت‌نام کرده‌اید؟
            <span className="font-bold text-[var(--vaka-auth-primary)]">ورود به حساب کاربری</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
