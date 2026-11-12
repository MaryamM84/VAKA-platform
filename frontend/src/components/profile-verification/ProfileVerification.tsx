
"use client";

import { useState } from "react";

import IdentityStep from "./steps/IdentityStep";
import DocumentsStep from "./steps/DocumentsStep";
import ReviewStep from "./steps/ReviewStep";

import type {
  IdentityFormData,
  VerificationDocuments,
  VerificationStep,
} from "./types";

const initialIdentity: IdentityFormData = {
  firstName: "",
  lastName: "",
  nationalCode: "",
  birthDate: "",
  iban: "",
  mobile: "",
};

const initialDocuments: VerificationDocuments = {
  nationalCardFront: null,
  nationalCardBack: null,
};

const steps = [
  { number: 1, title: "اطلاعات هویتی" },
  { number: 2, title: "بارگذاری مدارک" },
  { number: 3, title: "بازبینی اطلاعات" },
];

export default function ProfileVerification() {
  const [currentStep, setCurrentStep] =
    useState<VerificationStep>(1);

  const [identity, setIdentity] =
    useState<IdentityFormData>(initialIdentity);

  const [documents, setDocuments] =
    useState<VerificationDocuments>(initialDocuments);

  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleNext = () => {
    setCurrentStep((previous) =>
      Math.min(previous + 1, 3) as VerificationStep
    );
  };

  const handleBack = () => {
    setCurrentStep((previous) =>
      Math.max(previous - 1, 1) as VerificationStep
    );
  };

  const handleSubmit = () => {
    if (!isConfirmed) return;

    // اتصال به API ثبت درخواست در مرحله اتصال بک‌اند انجام می‌شود.
    alert("اتصال به سرویس ثبت درخواست هنوز پیاده‌سازی نشده است.");
  };

  return (
    <div className="space-y-7">
      <div className="rounded-2xl border border-[var(--vaka-border)] bg-white p-5 sm:p-7">
        <div className="mb-7">
          <h2 className="text-xl font-bold text-[var(--vaka-text)]">
            احراز هویت مجری
          </h2>

          <p className="mt-2 text-sm leading-7 text-[var(--vaka-text-secondary)]">
            برای فعال شدن امکان ارسال پیشنهاد به پروژه‌ها،
            اطلاعات هویتی خود را تکمیل کنید.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8 grid grid-cols-3 gap-2">
          {steps.map((step) => {
            const isCompleted = currentStep > step.number;
            const isActive = currentStep === step.number;

            return (
              <div
                key={step.number}
                className="flex flex-col items-center gap-2 text-center"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                    isCompleted
                      ? "bg-[var(--vaka-success)] text-white"
                      : isActive
                        ? "bg-[var(--vaka-primary)] text-white"
                        : "bg-[var(--vaka-bg)] text-[var(--vaka-text-muted)]"
                  }`}
                >
                  {isCompleted ? "✓" : step.number}
                </div>

                <span
                  className={`text-xs sm:text-sm ${
                    isActive || isCompleted
                      ? "font-semibold text-[var(--vaka-primary)]"
                      : "text-[var(--vaka-text-muted)]"
                  }`}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          <IdentityStep
            data={identity}
            onChange={setIdentity}
            onNext={handleNext}
          />
        )}

        {currentStep === 2 && (
          <DocumentsStep
            data={documents}
            onChange={setDocuments}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 3 && (
          <ReviewStep
            identity={identity}
            documents={documents}
            onBack={handleBack}
            onSubmit={handleSubmit}
            isConfirmed={isConfirmed}
            onConfirmChange={setIsConfirmed}
          />
        )}
      </div>

      <div className="rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-primary-pale)] p-4">
        <p className="text-sm leading-7 text-[var(--vaka-text-secondary)]">
          <span className="font-semibold text-[var(--vaka-primary)]">
            توجه:
          </span>{" "}
          اطلاعات و مدارک شما برای بررسی هویت استفاده می‌شوند.
          پس از اتصال سرویس ثبت درخواست، وضعیت بررسی از طریق
          پروفایل قابل پیگیری خواهد بود.
        </p>
      </div>
    </div>
  );
}
