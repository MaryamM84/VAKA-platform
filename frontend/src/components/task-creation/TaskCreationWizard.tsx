
"use client";

import { useState } from "react";
import Step1Details from "./steps/Step1Details";
import Step2Schedule from "./steps/Step2Schedule";
import Step3Location from "./steps/Step3Location";
import Step4Budget from "./steps/Step4Budget";
import Step5Review from "./steps/Step5Review";
import { createTask } from "@/lib/task-api";
import { buildTaskCreatePayload } from "@/lib/task-payload";
import { initialTaskFormData, type TaskFormData } from "./types";

const steps = [
  {
    title: "عنوان و مشخصات",
    description: "معرفی و توضیح کار",
    icon: "/icons/step1-clipboard-pen.svg",
  },
  {
    title: "زمان‌بندی و فوریت",
    description: "زمان انجام کار",
    icon: "/icons/step2-clock.svg",
  },
  {
    title: "محدوده مکانی",
    description: "محل انجام کار",
    icon: "/icons/step3-map-pin.svg",
  },
  {
    title: "بودجه و هزینه‌ها",
    description: "هزینه انجام کار",
    icon: "/icons/step4-wallet-cards.svg",
  },
  {
    title: "بررسی و تأیید نهایی",
    description: "مرور اطلاعات",
    icon: "/icons/step5-clipboard-check.svg",
  },
];

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function isValidDateTime(value: string): boolean {
  if (!value) return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) return false;

  const [, year, month, day, hour, minute] = match;

  return (
    Number(year) > 0 &&
    Number(month) >= 1 &&
    Number(month) <= 12 &&
    Number(day) >= 1 &&
    Number(day) <= 31 &&
    Number(hour) >= 0 &&
    Number(hour) <= 23 &&
    Number(minute) >= 0 &&
    Number(minute) <= 59
  );
}

function isValidCoordinates(latitude: string, longitude: string): boolean {
  if (!latitude || !longitude) return false;

  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function isValidAmount(value: string): boolean {
  if (!value.trim()) return false;

  const normalized = normalizeDigits(value).replace(/,/g, "").trim();
  const amount = Number(normalized);

  return Number.isFinite(amount) && amount >= 0;
}

function validateStep(step: number, data: TaskFormData): ValidationResult {
  const errors: string[] = [];

  switch (step) {
    // گام اول: عنوان و مشخصات
    case 0: {
      if (!data.title.trim()) {
        errors.push("عنوان کار را وارد کنید.");
      }

      if (!data.categoryId.trim()) {
        errors.push("دسته‌بندی کار را انتخاب کنید.");
      }

      if (!data.description.trim()) {
        errors.push("شرح کامل کار را وارد کنید.");
      }

      if (!data.deliveryCriteria.trim()) {
        errors.push("معیارهای تحویل کار را مشخص کنید.");
      }

      break;
    }

    // گام دوم: زمان‌بندی
    case 1: {
      const duration = Number(
        normalizeDigits(data.estimatedDurationMinutes),
      );

      if (
        !data.estimatedDurationMinutes.trim() ||
        !Number.isInteger(duration) ||
        duration < 1 ||
        duration > 300
      ) {
        errors.push("مدت انجام کار باید عددی بین ۱ تا ۳۰۰ دقیقه باشد.");
      }

      if (!["normal", "urgent"].includes(data.urgency)) {
        errors.push("میزان فوریت انجام کار را مشخص کنید.");
      }

      if (!isValidDateTime(data.proposalDeadlineAt)) {
        errors.push("تاریخ و ساعت مهلت دریافت پیشنهادها معتبر نیست.");
      }

      if (!isValidDateTime(data.executionStartTime)) {
        errors.push("تاریخ و ساعت شروع بازه اجرای کار معتبر نیست.");
      }

      if (!isValidDateTime(data.executionWindowEndAt)) {
        errors.push("تاریخ و ساعت پایان بازه انجام کار را مشخص کنید.");
      }

      if (
          isValidDateTime(data.executionStartTime) &&
          isValidDateTime(data.executionWindowEndAt)
        ) {
          const startTime = new Date(data.executionStartTime).getTime();
          const endTime = new Date(data.executionWindowEndAt).getTime();
        
          if (endTime <= startTime) {
            errors.push(
              "زمان پایان بازه اجرای کار باید بعد از زمان شروع باشد.",
            );
          }
        }

      // مهلت نهایی انجام کار اختیاری است.
      if (data.deadlineAt.trim() && !isValidDateTime(data.deadlineAt)) {
        errors.push("تاریخ و ساعت مهلت نهایی انجام کار معتبر نیست.");
      }

      break;
    }

    // گام سوم: محدوده مکانی
    case 2: {
      const mode = data.locationMode || "fixed";

      if (mode === "fixed") {
        if (
          !isValidCoordinates(data.locationLatitude, data.locationLongitude)
        ) {
          errors.push(
            "لطفاً محل انجام کار را با انتخاب نقطه روی نقشه ثبت کنید.",
          );
        }

        if (!data.locationAddress.trim()) {
          errors.push("آدرس محل انجام کار ثبت نشده است.");
        }
      } else if (mode === "route") {
        if (!isValidCoordinates(data.originLatitude, data.originLongitude)) {
          errors.push("موقعیت مبدأ را روی نقشه انتخاب کنید.");
        }

        if (!data.originAddress.trim()) {
          errors.push("آدرس مبدأ را وارد کنید.");
        }

        if (
          !isValidCoordinates(
            data.destinationLatitude,
            data.destinationLongitude,
          )
        ) {
          errors.push("موقعیت مقصد را روی نقشه انتخاب کنید.");
        }

        if (!data.destinationAddress.trim()) {
          errors.push("آدرس مقصد را وارد کنید.");
        }
      } else {
        errors.push("نوع محدوده مکانی را به‌درستی انتخاب کنید.");
      }

      break;
    }

    // گام چهارم: بودجه
    case 3: {
      if (!isValidAmount(data.wageBudgetAmount)) {
        errors.push("مبلغ دستمزد را به‌درستی وارد کنید.");
      }

      if (
        data.goodsPurchaseRequired === "true" &&
        !isValidAmount(data.itemCostCapAmount)
      ) {
        errors.push(
          "با توجه به نیاز به خرید کالا، سقف هزینه خرید را مشخص کنید.",
        );
      }

      if (!["true", "false"].includes(data.goodsPurchaseRequired)) {
        errors.push("وضعیت نیاز به خرید کالا را مشخص کنید.");
      }

      if (!["true", "false"].includes(data.invoiceRequired)) {
        errors.push("وضعیت نیاز به فاکتور را مشخص کنید.");
      }

      break;
    }

    default:
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default function TaskCreationWizard() {
  const [currentStep, setCurrentStep] = useState(0);

  const [formData, setFormData] = useState<TaskFormData>(initialTaskFormData);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [submitError, setSubmitError] = useState("");

  const [submitMessage, setSubmitMessage] = useState("");

  function handleFieldChange(field: keyof TaskFormData, value: string) {
    setFormData((previousData) => ({
      ...previousData,
      [field]: value,
    }));

    setValidationErrors([]);
  }

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function goNext() {
    const result = validateStep(currentStep, formData);

    if (!result.valid) {
      setValidationErrors(result.errors);

      window.setTimeout(() => {
        document.getElementById("task-validation-errors")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 50);

      return;
    }

    setValidationErrors([]);

    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));

    scrollToTop();
  }

  function goBack() {
    setValidationErrors([]);

    setCurrentStep((step) => Math.max(step - 1, 0));

    scrollToTop();
  }

  function goToStep(index: number) {
    // اجازه رفتن به مراحل تکمیل‌نشده وجود ندارد.
    if (index > currentStep) return;

    setValidationErrors([]);
    setCurrentStep(index);
    scrollToTop();
  }

  function editStep(index: number) {
    if (index < 0 || index >= currentStep) return;

    setValidationErrors([]);
    setCurrentStep(index);
    scrollToTop();
  }

  async function handlePublishTask() {
    setIsSavingDraft(true);
    setSubmitError("");
    setSubmitMessage("");

    try {
      const payload = buildTaskCreatePayload(formData);
      const createdTask = await createTask(payload);

      setSubmitMessage(
        `تسک با موفقیت ثبت شد. شناسه: ${createdTask.task_id}`,
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "انتشار تسک انجام نشد.",
      );
    } finally {
      setIsSavingDraft(false);
    }
  }

  return (
    <main className="task-creation-page" dir="rtl">
      <div className="mx-auto w-full max-w-6xl">
        <nav aria-label="مراحل ایجاد کار" className="task-stepper mb-6">
          <ol className="flex min-w-[600px] items-center lg:min-w-0">
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              const isDisabled = index > currentStep;

              const iconPath = isCompleted ? "/icons/check.svg" : step.icon;

              const iconColor =
                isActive || isCompleted
                  ? "var(--vaka-surface)"
                  : "var(--vaka-text-muted)";

              return (
                <li
                  key={step.title}
                  className="flex min-w-0 flex-1 items-center"
                  aria-current={isActive ? "step" : undefined}
                >
                  <button
                    type="button"
                    onClick={() => goToStep(index)}
                    disabled={isDisabled}
                    aria-label={`رفتن به مرحله ${index + 1}: ${step.title}`}
                    aria-disabled={isDisabled}
                    className={`flex min-w-0 items-center gap-2 text-right ${
                      isDisabled
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }`}
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                        isActive || isCompleted
                          ? "bg-[var(--vaka-primary)] text-white shadow-sm"
                          : "bg-[var(--vaka-primary-pale)]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="block size-5"
                        style={{
                          backgroundColor: iconColor,
                          maskImage: `url("${iconPath}")`,
                          WebkitMaskImage: `url("${iconPath}")`,
                          maskRepeat: "no-repeat",
                          WebkitMaskRepeat: "no-repeat",
                          maskPosition: "center",
                          WebkitMaskPosition: "center",
                          maskSize: "contain",
                          WebkitMaskSize: "contain",
                        }}
                      />
                    </span>

                    <span className="min-w-0">
                      <span
                        className={`block whitespace-nowrap text-[10px] sm:text-xs ${
                          isActive
                            ? "font-semibold text-[var(--vaka-primary)]"
                            : "text-[var(--vaka-text-muted)]"
                        }`}
                      >
                        گام {index + 1}
                      </span>

                      <span
                        className={`mt-1 block whitespace-nowrap text-xs sm:text-sm ${
                          isActive
                            ? "font-bold text-[var(--vaka-text)]"
                            : "text-[var(--vaka-text-secondary)]"
                        }`}
                      >
                        {step.title}
                      </span>
                    </span>
                  </button>

                  {index < steps.length - 1 && (
                    <div
                      aria-hidden="true"
                      className={`mx-3 h-0.5 min-w-3 flex-1 ${
                        isCompleted
                          ? "bg-[var(--vaka-primary-soft)]"
                          : "bg-[var(--vaka-border-soft)]"
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="overflow-hidden rounded-3xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-surface)] shadow-sm">
          <header className="border-b border-[var(--vaka-border-soft)] px-5 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full bg-[var(--vaka-primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--vaka-primary)]">
                  ایجاد کار جدید
                </span>

                <h1 className="mt-4 text-xl font-bold text-[var(--vaka-text)] sm:text-2xl">
                  گام {currentStep + 1} از {steps.length}:{" "}
                  {steps[currentStep].title}
                </h1>
              </div>
            </div>

            <div
              className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--vaka-primary-pale)]"
              role="progressbar"
              aria-label="میزان پیشرفت مراحل فرم"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(
                ((currentStep + 1) / steps.length) * 100,
              )}
            >
              <div
                className="h-full rounded-full bg-[var(--vaka-primary)] transition-all duration-300"
                style={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                }}
              />
            </div>
          </header>

          <div className="min-h-80 px-5 py-8 sm:px-8 sm:py-10">
            {validationErrors.length > 0 && (
              <div
                id="task-validation-errors"
                role="alert"
                aria-live="assertive"
                className="mb-6 rounded-2xl border border-[var(--vaka-danger)]/30 bg-[var(--vaka-danger)]/5 p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg text-[var(--vaka-danger)]">⚠</span>

                  <h3 className="text-sm font-bold text-[var(--vaka-danger)]">
                    لطفاً موارد زیر را اصلاح کنید:
                  </h3>
                </div>

                <ul className="list-inside list-disc space-y-2 text-sm leading-7 text-[var(--vaka-text)]">
                  {validationErrors.map((error, index) => (
                    <li key={`${index}-${error}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {currentStep === 0 ? (
              <Step1Details data={formData} onChange={handleFieldChange} />
            ) : currentStep === 1 ? (
              <Step2Schedule data={formData} onChange={handleFieldChange} />
            ) : currentStep === 2 ? (
              <Step3Location data={formData} onChange={handleFieldChange} />
            ) : currentStep === 3 ? (
              <Step4Budget data={formData} onChange={handleFieldChange} />
            ) : (
              <Step5Review
                data={formData}
                onEditStep={editStep}
                onBack={() => editStep(3)}
                onPublish={handlePublishTask}
                isPublishing={isSavingDraft}
                submitError={submitError}
                submitMessage={submitMessage}
              />
            )}
          </div>

          {!isLastStep && (
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--vaka-border-soft)] px-5 py-5 sm:px-8">
              <button
                type="button"
                onClick={goBack}
                disabled={isFirstStep}
                className="rounded-full border border-[var(--vaka-border)] px-5 py-3 text-sm font-semibold text-[var(--vaka-text-secondary)] transition hover:bg-[var(--vaka-primary-pale)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                مرحله قبل
              </button>

              <button
                type="button"
                onClick={goNext}
                className="rounded-full bg-[var(--vaka-primary)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--vaka-primary-hover)]"
              >
                مرحله بعد: {steps[currentStep + 1].title}
              </button>
            </footer>
          )}
        </section>
      </div>
    </main>
  );
}
