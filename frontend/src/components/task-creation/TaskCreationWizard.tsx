"use client";

import { useState } from "react";
import Step1Details from "./steps/Step1Details";
import Step2Schedule from "./steps/Step2Schedule";
import Step3Location from "./steps/Step3Location";
import Step4Budget from "./steps/Step4Budget";
import Step5Review from "./steps/Step5Review";
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

export default function TaskCreationWizard() {
  const [currentStep, setCurrentStep] = useState(0);

  const [formData, setFormData] = useState<TaskFormData>(initialTaskFormData);

  function handleFieldChange(field: keyof TaskFormData, value: string) {
    setFormData((previousData) => ({
      ...previousData,
      [field]: value,
    }));
  }

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  function goNext() {
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  return (
    <main className="task-creation-page" dir="rtl">
      <div className="mx-auto w-full max-w-6xl">
        <nav aria-label="مراحل ایجاد کار" className="task-stepper mb-6">
          <ol className="flex min-w-[600px] items-center lg:min-w-0">
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              const iconPath = isCompleted ? "/icons/check.svg" : step.icon;

              const iconColor =
                isActive || isCompleted ? "#ffffff" : "var(--vaka-text-muted)";

              return (
                <li
                  key={step.title}
                  className="flex min-w-0 flex-1 items-center"
                  aria-current={isActive ? "step" : undefined}
                >
                  <button
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    aria-label={`رفتن به مرحله ${index + 1}: ${step.title}`}
                    className="flex min-w-0 items-center gap-2 text-right"
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                        isActive || isCompleted
                          ? "bg-[#006557] text-white shadow-sm"
                          : "bg-[#edf2ef]"
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
                            ? "font-semibold text-[#006557]"
                            : "text-[#89948f]"
                        }`}
                      >
                        گام {index + 1}
                      </span>

                      <span
                        className={`mt-1 block whitespace-nowrap text-xs sm:text-sm ${
                          isActive
                            ? "font-bold text-[#182522]"
                            : "text-[#84908a]"
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
                        isCompleted ? "bg-[#7bb8a9]" : "bg-[#e5ece8]"
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="overflow-hidden rounded-3xl border border-[#e5ece8] bg-white/95 shadow-sm">
          <header className="border-b border-[#edf1ee] px-5 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full bg-[#e7f1ec] px-3 py-1.5 text-xs font-medium text-[#006557]">
                  ایجاد کار جدید
                </span>

                <h1 className="mt-4 text-xl font-bold text-[#182522] sm:text-2xl">
                  گام {currentStep + 1} از {steps.length}:{" "}
                  {steps[currentStep].title}
                </h1>
              </div>
            </div>

            <div
              className="mt-6 h-2 overflow-hidden rounded-full bg-[#edf2ef]"
              role="progressbar"
              aria-label="میزان پیشرفت مراحل فرم"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(
                ((currentStep + 1) / steps.length) * 100,
              )}
            >
              <div
                className="h-full rounded-full bg-[#006557] transition-all duration-300"
                style={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                }}
              />
            </div>
          </header>

          <div className="min-h-80 px-5 py-8 sm:px-8 sm:py-10">
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
                onEditStep={setCurrentStep}
                onBack={() => setCurrentStep(3)}
              />
            )}
          </div>

          {currentStep < 4 && (
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1ee] px-5 py-5 sm:px-8">
              <button
                type="button"
                onClick={goBack}
                disabled={isFirstStep}
                className="rounded-full border border-[#dce5df] px-5 py-3 text-sm font-semibold text-[#35433d] transition hover:bg-[#f5f8f6] disabled:cursor-not-allowed disabled:opacity-40"
              >
                مرحله قبل
              </button>

              <button
                type="button"
                onClick={goNext}
                className="rounded-full bg-[#006557] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#005448]"
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
