"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/auth-api";
import {
  fromVerificationIdentityResponse,
  getVerificationIdentity,
  getVerificationStatus,
  mapVerificationStatus,
  saveVerificationIdentity,
  submitVerification,
  uploadVerificationDocument,
  type VerificationDocumentType,
  type VerificationStatusResponse,
} from "@/lib/verification-api";
import IdentityStep from "./steps/IdentityStep";
import DocumentsStep from "./steps/DocumentsStep";
import ReviewStep from "./steps/ReviewStep";
import VerificationStatus from "./VerificationStatus";
import type { IdentityFormData, VerificationDocuments, VerificationStep } from "./types";

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
  { number: 3, title: "بازبینی و ثبت" },
];

export default function ProfileVerification() {
  const [currentStep, setCurrentStep] = useState<VerificationStep>(1);
  const [identity, setIdentity] = useState<IdentityFormData>(initialIdentity);
  const [documents, setDocuments] = useState<VerificationDocuments>(initialDocuments);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatusResponse | null>(null);
  const [uploadedDocumentIds, setUploadedDocumentIds] = useState<Partial<Record<VerificationDocumentType, string>>>({});

  useEffect(() => {
    let active = true;

    async function loadVerification() {
      if (!getAccessToken()) {
        if (active) {
          setIsLoading(false);
          setNotice("برای مشاهده یا ثبت وضعیت احراز هویت ابتدا وارد حساب کاربری شوید.");
        }
        return;
      }

      try {
        const status = await getVerificationStatus();
        if (!active) return;
        setVerificationStatus(status);

        if (status.identity_saved) {
          const savedIdentity = await getVerificationIdentity();
          if (active && savedIdentity) {
            setIdentity(fromVerificationIdentityResponse(savedIdentity));
          }
        }

        if (active) {
          const existingIds: Partial<Record<VerificationDocumentType, string>> = {};
          for (const document of status.documents ?? []) {
            existingIds[document.document_type] = document.document_id;
          }
          setUploadedDocumentIds(existingIds);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "دریافت وضعیت احراز هویت انجام نشد.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadVerification();
    return () => { active = false; };
  }, []);

  const handleNext = () => {
    setNotice("");
    setCurrentStep((previous) => Math.min(previous + 1, 3) as VerificationStep);
  };

  const handleBack = () => {
    setNotice("");
    setCurrentStep((previous) => Math.max(previous - 1, 1) as VerificationStep);
  };

  const handleSubmit = async () => {
    if (!isConfirmed || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    setNotice("");

    try {
      await saveVerificationIdentity(identity);

      const requiredUploads: {
        type: VerificationDocumentType;
        file: File | null;
      }[] = [
        { type: "NATIONAL_CARD_FRONT", file: documents.nationalCardFront },
        { type: "NATIONAL_CARD_BACK", file: documents.nationalCardBack },
      ];

      for (const item of requiredUploads) {
        if (!item.file || uploadedDocumentIds[item.type]) continue;
        const uploaded = await uploadVerificationDocument(item.type, item.file);
        setUploadedDocumentIds((current) => ({
          ...current,
          [item.type]: uploaded.document_id,
        }));
      }

      const submittedStatus = await submitVerification();
      setVerificationStatus(submittedStatus);
      setNotice("درخواست احراز هویت با موفقیت برای بررسی ارسال شد.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ثبت درخواست احراز هویت انجام نشد.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--vaka-border)] bg-white p-5 sm:p-7">
        <div className="mb-7">
          <h2 className="text-xl font-bold text-[var(--vaka-text)]">
            احراز هویت مجری
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--vaka-text-secondary)]">
            برای فعال شدن امکان ارسال پیشنهاد به پروژه‌ها، اطلاعات هویتی خود را تکمیل کنید.
          </p>
        </div>

        {/* Three-step progress indicator */}
        <nav aria-label="مراحل احراز هویت" className="mb-8">
          <ol className="flex items-center gap-2 sm:gap-3">
            {steps.map((step, index) => {
              const isCompleted = currentStep > step.number;
              const isActive = currentStep === step.number;

              return (
                <li
                  key={step.number}
                  className="flex min-w-0 flex-1 items-center"
                  aria-current={isActive ? "step" : undefined}
                >
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
                    <span
                      className={[
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all",
                        isCompleted
                          ? "bg-[var(--vaka-success)] text-white"
                          : isActive
                            ? "bg-[var(--vaka-primary)] text-white ring-4 ring-[var(--vaka-primary-pale)]"
                            : "bg-[var(--vaka-bg)] text-[var(--vaka-text-muted)]",
                      ].join(" ")}
                    >
                      {isCompleted ? "✓" : step.number.toLocaleString("fa-IR")}
                    </span>

                    <span className="min-w-0 text-center sm:text-right">
                      <span
                        className={[
                          "block text-[11px] leading-5 sm:text-sm",
                          isActive || isCompleted
                            ? "font-semibold text-[var(--vaka-primary)]"
                            : "text-[var(--vaka-text-muted)]",
                        ].join(" ")}
                      >
                        {step.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-[var(--vaka-text-muted)] sm:text-xs">
                        مرحله {step.number.toLocaleString("fa-IR")}
                      </span>
                    </span>
                  </div>

                  {index < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={[
                        "mx-1 h-0.5 min-w-2 flex-1 rounded-full sm:mx-2",
                        currentStep > step.number
                          ? "bg-[var(--vaka-primary)]"
                          : "bg-[var(--vaka-border)]",
                      ].join(" ")}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {currentStep === 1 && (
          <IdentityStep data={identity} onChange={setIdentity} onNext={handleNext} />
        )}
        {currentStep === 2 && (
          <DocumentsStep
            data={documents}
            onChange={setDocuments}
            onNext={handleNext}
            onBack={handleBack}
            hasUploadedFront={Boolean(uploadedDocumentIds.NATIONAL_CARD_FRONT)}
            hasUploadedBack={Boolean(uploadedDocumentIds.NATIONAL_CARD_BACK)}
          />
        )}
        {currentStep === 3 && (
          <ReviewStep
            identity={identity}
            documents={documents}
            hasUploadedFront={Boolean(uploadedDocumentIds.NATIONAL_CARD_FRONT)}
            hasUploadedBack={Boolean(uploadedDocumentIds.NATIONAL_CARD_BACK)}
            onBack={handleBack}
            onEditIdentity={() => setCurrentStep(1)}
            onEditDocuments={() => setCurrentStep(2)}
            onSubmit={handleSubmit}
            isConfirmed={isConfirmed}
            onConfirmChange={setIsConfirmed}
            isPreparing={isSubmitting}
          />
        )}

        {notice && (
          <div role="status" className="mt-5 rounded-xl border border-[var(--vaka-success)]/30 bg-[var(--vaka-success)]/10 p-4 text-sm leading-7 text-[var(--vaka-text)]">
            {notice}
          </div>
        )}
        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-[var(--vaka-danger)]/30 bg-[var(--vaka-danger)]/5 p-4 text-sm leading-7 text-[var(--vaka-text)]">
            {error}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-[var(--vaka-border)] bg-white p-5 text-sm text-[var(--vaka-text-secondary)]">در حال دریافت وضعیت احراز هویت...</div>
      ) : (
        <VerificationStatus
          status={verificationStatus ? mapVerificationStatus(verificationStatus.verification_status) : "not_submitted"}
          rejectionReason={verificationStatus?.rejection_reason}
        />
      )}

      <div className="rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-primary-pale)] p-4">
        <p className="text-sm leading-7 text-[var(--vaka-text-secondary)]">
          <span className="font-semibold text-[var(--vaka-primary)]">توجه:</span>{" "}
          اطلاعات و مدارک شما برای بررسی هویت استفاده می‌شوند. وضعیت درخواست از سرویس احراز هویت دریافت و در همین بخش نمایش داده می‌شود.
        </p>
      </div>
    </div>
  );
}
