"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./BidSubmissionFlow.module.css";

export type BidTaskSummary = {
  id: string;
  /** Example: VK-92810. Used to form the visible order/tracking code. */
  orderCode?: string;
  title: string;
  budget: number;
  purchaseCeiling?: number;
  location?: string;
  requestedDeliveryMinutes?: number;
};

export type BidDraft = {
  taskId: string;
  orderCode: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  deliveryMinutes: number;
  message: string;
  validityDays: number;
  acceptedPlatformTerms: boolean;
};

export type BidSubmissionResult = {
  trackingCode: string;
  statusText?: string;
  /** True only for the built-in localStorage preview mode. */
  demo?: boolean;
};

export type BidSubmissionHandler = (
  draft: BidDraft,
  task: BidTaskSummary,
) => Promise<BidSubmissionResult>;

type BidSubmissionFlowProps = {
  task: BidTaskSummary | null;
  onClose: () => void;
  onSubmit?: BidSubmissionHandler;
  onTrackMyTasks?: () => void;
  onBrowseTasks?: () => void;
  feePercent?: number;
};

type IconName =
  | "close"
  | "wallet"
  | "pin"
  | "basket"
  | "clock"
  | "check"
  | "receipt"
  | "bolt"
  | "arrow";

const DEMO_STORAGE_KEY = "vaka.bid-submissions.demo.v1";
const DEFAULT_MESSAGE =
  "سلام و احترام، بنده نزدیک قنادی ناتالی هستم و باکس مخصوص خنک‌دار ضد ضربه به همراه دارم. خرید دقیقاً طبق هماهنگی انجام و فاکتور در چت بارگذاری خواهد شد.";

function toAsciiDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function toPersianDigits(value: string) {
  return value
    .replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".charAt(Number(digit)))
    .replace(/[٠-٩]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".charAt("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function parseNumericInput(value: string) {
  const digits = toAsciiDigits(value).replace(/[,٬\s]/g, "");
  if (!/^\d*$/.test(digits)) return NaN;
  return digits ? Number(digits) : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)));
}

function formatMoney(value: number) {
  return formatNumber(value);
}

function formatShortThousands(value: number) {
  return `${formatNumber(Math.round(value / 1000))} ت`;
}

function normalizedOrderCode(task: BidTaskSummary) {
  const value = task.orderCode?.trim() || task.id.trim();
  return value.toUpperCase().startsWith("VK-") ? value.toUpperCase() : `VK-${value}`;
}

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const paths: Record<IconName, ReactNode> = {
    close: <path d="m6 6 12 12M18 6 6 18" />,
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 9h18M16 14h2" />
        <path d="M6 6V4.8A1.8 1.8 0 0 1 7.8 3H19" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2.2" />
      </>
    ),
    basket: (
      <>
        <path d="m4 9 2 11h12l2-11H4Z" />
        <path d="m8 9 4-6 4 6M9 13v3M15 13v3" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4.2 4.2L19 6.8" />,
    receipt: (
      <>
        <path d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21V3Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
    arrow: <path d="M19 12H5m0 0 6-6m-6 6 6 6" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function getDemoTrackingCode(task: BidTaskSummary) {
  return `${normalizedOrderCode(task)}-BID`;
}

/**
 * Local preview only. Replace this with an API-backed onSubmit handler when
 * the Django bid endpoint is ready. This function does not notify an employer.
 */
async function saveDemoBid(
  draft: BidDraft,
  task: BidTaskSummary,
): Promise<BidSubmissionResult> {
  const trackingCode = getDemoTrackingCode(task);
  const record = {
    ...draft,
    taskTitle: task.title,
    trackingCode,
    status: "pending",
    createdAt: new Date().toISOString(),
    mode: "demo",
  };

  try {
    const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    const records = Array.isArray(parsed) ? parsed : [];
    window.localStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify([...records, record]),
    );
  } catch {
    throw new Error(
      "ذخیره پیشنهاد در مرورگر انجام نشد. فضای ذخیره‌سازی مرورگر را بررسی کنید.",
    );
  }

  return {
    trackingCode,
    statusText: "در انتظار بررسی و تأیید کارفرما",
    demo: true,
  };
}

export default function BidSubmissionFlow({
  task,
  onClose,
  onSubmit,
  onTrackMyTasks,
  onBrowseTasks,
  feePercent = 12,
}: BidSubmissionFlowProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"form" | "success">("form");
  const [amount, setAmount] = useState(250000);
  const [amountInput, setAmountInput] = useState("۲۵۰٬۰۰۰");
  const [deliveryMinutes, setDeliveryMinutes] = useState(25);
  const [deliveryInput, setDeliveryInput] = useState("۲۵");
  const [selectedDeliveryPreset, setSelectedDeliveryPreset] = useState<
    "fast" | "match" | "late" | null
  >("fast");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [validityDays, setValidityDays] = useState(2);
  const [validityInput, setValidityInput] = useState("۲");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BidSubmissionResult | null>(null);

  const submittingRef = useRef(false);
  const hasSubmitHandler = Boolean(onSubmit);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const isOpen = Boolean(task);
  const taskId = task?.id;
  const taskBudget = task?.budget;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!taskId) return;

    const initialAmount = Math.max(10000, taskBudget || 250000);
    setView("form");
    setAmount(initialAmount);
    setAmountInput(formatMoney(initialAmount));
    setDeliveryMinutes(25);
    setDeliveryInput("۲۵");
    setSelectedDeliveryPreset("fast");
    setMessage(hasSubmitHandler ? "" : DEFAULT_MESSAGE);
    setValidityDays(2);
    setValidityInput("۲");
    setAcceptedTerms(false);
    setIsSubmitting(false);
    setError("");
    setResult(null);
  }, [taskId, taskBudget, hasSubmitHandler]);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!submittingRef.current) onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, mounted]);

  const budget = task?.budget ?? 250000;
  const competitiveAmount = Math.round((budget * 1.32) / 10000) * 10000;
  const specialAmount = Math.round((budget * 1.12) / 10000) * 10000;
  const platformFee = Math.round((amount * feePercent) / 100);
  const netAmount = Math.max(0, amount - platformFee);
  const orderCode = task ? normalizedOrderCode(task) : "VK-92810";
  const trackingCode = result?.trackingCode || `${orderCode}-BID`;
  const requestedMinutes = task?.requestedDeliveryMinutes ?? 45;

  const deliveryLabel = useMemo(() => {
    if (deliveryMinutes <= 30) return "سریع‌تر (۳۰ د)";
    if (deliveryMinutes === requestedMinutes) {
      return `مطابق کارفرما (${formatNumber(requestedMinutes)} د)`;
    }
    if (deliveryMinutes >= 50) return "دیرتر (۵۰ د)";
    return `${formatNumber(deliveryMinutes)} دقیقه`;
  }, [deliveryMinutes, requestedMinutes]);

  const amountPresets = [
    {
      key: "special",
      label: `ویژه (${formatShortThousands(specialAmount)})`,
      value: specialAmount,
    },
    {
      key: "competitive",
      label: `رقابتی (${formatShortThousands(competitiveAmount)})`,
      value: competitiveAmount,
    },
    {
      key: "budget",
      label: `بودجه (${formatShortThousands(budget)})`,
      value: budget,
    },
  ];

  const updateAmount = (nextValue: number) => {
    const safeValue = Math.max(
      10000,
      Math.min(1000000000, Math.round(nextValue)),
    );
    setAmount(safeValue);
    setAmountInput(formatMoney(safeValue));
  };

  const updateDelivery = (nextValue: number) => {
    const safeValue = Math.max(5, Math.min(240, Math.round(nextValue)));
    setDeliveryMinutes(safeValue);
    setDeliveryInput(formatNumber(safeValue));
    setSelectedDeliveryPreset(
      safeValue <= 30
        ? "fast"
        : safeValue === requestedMinutes
          ? "match"
          : safeValue >= 50
            ? "late"
            : null,
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!task || submittingRef.current) return;

    if (!Number.isSafeInteger(amount) || amount < 10000 || amount > 1000000000) {
      setError("مبلغ پیشنهاد باید حداقل ۱۰٬۰۰۰ تومان باشد.");
      return;
    }
    if (!Number.isSafeInteger(deliveryMinutes) || deliveryMinutes < 5 || deliveryMinutes > 240) {
      setError("زمان تحویل باید بین ۵ تا ۲۴۰ دقیقه باشد.");
      return;
    }
    if (message.trim().length < 10) {
      setError("لطفاً توضیحات پیشنهاد را حداقل در ۱۰ کاراکتر بنویسید.");
      return;
    }
    if (!Number.isSafeInteger(validityDays) || validityDays < 1 || validityDays > 30) {
      setError("اعتبار پیشنهاد باید بین ۱ تا ۳۰ روز باشد.");
      return;
    }
    if (!acceptedTerms) {
      setError(
        "برای ارسال پیشنهاد، پذیرش قوانین امانتداری و سلامت کالا الزامی است.",
      );
      return;
    }

    setError("");
    submittingRef.current = true;
    setIsSubmitting(true);

    const draft: BidDraft = {
      taskId: task.id,
      orderCode,
      amount,
      platformFee,
      netAmount,
      deliveryMinutes,
      message: message.trim(),
      validityDays,
      acceptedPlatformTerms: acceptedTerms,
    };

    try {
      const submissionResult = onSubmit
        ? await onSubmit(draft, task)
        : await saveDemoBid(draft, task);

      if (!submissionResult?.trackingCode) {
        throw new Error("پاسخ ثبت پیشنهاد معتبر نیست؛ کد پیگیری دریافت نشد.");
      }

      setResult(submissionResult);
      setView("success");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "ثبت پیشنهاد انجام نشد. لطفاً دوباره تلاش کنید.",
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!mounted || !task) return null;

  const closeModal = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleTrackMyTasks = () => {
    onTrackMyTasks?.();
    onClose();
  };

  const handleBrowseTasks = () => {
    onBrowseTasks?.();
    onClose();
  };

  const closeButton = (
    <button
      ref={closeButtonRef}
      type="button"
      className={styles.closeButton}
      aria-label="بستن پنجره"
      onClick={closeModal}
      disabled={isSubmitting}
    >
      <Icon name="close" size={17} />
    </button>
  );

  const modal = (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      {view === "form" ? (
        <section
          ref={dialogRef}
          className={`${styles.modal} ${styles.formModal}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vaka-bid-modal-title"
          dir="rtl"
        >
          <header className={styles.formHeader}>
            {closeButton}
            <div className={styles.headerContent}>
              <div className={styles.headerTopline}>
                <span className={styles.orderBadge}>
                  <span>سفارش #{orderCode}</span>
                  <Icon name="check" size={13} />
                </span>
              </div>
              <h2 id="vaka-bid-modal-title" className={styles.formTitle}>
                ثبت پیشنهاد: {task.title}
              </h2>
              <div className={styles.taskMeta}>
                <span>
                  <Icon name="wallet" size={14} />
                  <span>
                    بودجه: <strong>{formatMoney(budget)} تومان</strong>
                  </span>
                </span>
                <i aria-hidden="true">•</i>
                <span>
                  <Icon name="pin" size={14} />
                  <span>{task.location || "سه‌راهی به سیدخندان"}</span>
                </span>
                <i aria-hidden="true">•</i>
                <span>
                  <Icon name="basket" size={14} />
                  <span>
                    سقف خرید: <strong>{formatMoney(task.purchaseCeiling ?? 180000)}</strong>
                  </span>
                </span>
              </div>
            </div>
          </header>

          <form className={styles.formLayout} onSubmit={handleSubmit}>
            <div className={styles.formBody}>
              <section
                className={styles.sectionCard}
                aria-labelledby="bid-amount-heading"
              >
                <div className={styles.sectionHeading}>
                  <span className={styles.stepNumber}>۱</span>
                  <h3 id="bid-amount-heading">مبلغ پیشنهادی دستمزد:</h3>
                </div>

                <div className={styles.amountControls}>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      aria-label="کاهش مبلغ پیشنهاد"
                      onClick={() => updateAmount(amount - 10000)}
                    >
                      −
                    </button>
                    <label className={styles.stepperValue}>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="مبلغ پیشنهاد به تومان"
                        value={amountInput}
                        onFocus={() => setAmountInput(formatMoney(amount))}
                        onChange={(event) => {
                          const localizedValue = toPersianDigits(event.target.value);
                          const next = parseNumericInput(localizedValue);
                          setAmount(next);
                          setAmountInput(localizedValue);
                        }}
                        onBlur={() => setAmountInput(formatMoney(amount))}
                      />
                      <span>تومان</span>
                    </label>
                    <button
                      type="button"
                      aria-label="افزایش مبلغ پیشنهاد"
                      onClick={() => updateAmount(amount + 10000)}
                    >
                      +
                    </button>
                  </div>

                  <div className={styles.presetButtons}>
                    {amountPresets.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        className={amount === preset.value ? styles.presetActive : ""}
                        onClick={() => updateAmount(preset.value)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.feeSummary}>
                  <strong>خالص دریافتی: {formatMoney(netAmount)} تومان</strong>
                  <span>
                    کارمزد پلتفرم و بیمه ({formatNumber(feePercent)}٪):
                    <b>− {formatMoney(platformFee)} تومان</b>
                  </span>
                </div>
              </section>

              <section
                className={styles.sectionCard}
                aria-labelledby="bid-delivery-heading"
              >
                <div className={styles.sectionHeading}>
                  <span className={styles.stepNumber}>۲</span>
                  <h3 id="bid-delivery-heading">زمان‌بندی و تعهد تحویل:</h3>
                </div>

                <div className={styles.requestedTime}>
                  <span>
                    <Icon name="clock" size={15} />
                    زمان درخواستی کارفرما:
                  </span>
                  <strong>{formatNumber(requestedMinutes)} دقیقه</strong>
                </div>

                <div className={styles.deliveryControls}>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      aria-label="کاهش زمان تحویل"
                      onClick={() => updateDelivery(deliveryMinutes - 5)}
                    >
                      −
                    </button>
                    <label className={styles.stepperValue}>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="زمان تحویل به دقیقه"
                        value={deliveryInput}
                        onFocus={() => setDeliveryInput(formatNumber(deliveryMinutes))}
                        onChange={(event) => {
                          const localizedValue = toPersianDigits(event.target.value);
                          const next = parseNumericInput(localizedValue);
                          setDeliveryMinutes(next);
                          setDeliveryInput(localizedValue);
                          setSelectedDeliveryPreset(null);
                        }}
                        onBlur={() => setDeliveryInput(formatNumber(deliveryMinutes))}
                      />
                      <span>دقیقه</span>
                    </label>
                    <button
                      type="button"
                      aria-label="افزایش زمان تحویل"
                      onClick={() => updateDelivery(deliveryMinutes + 5)}
                    >
                      +
                    </button>
                  </div>

                  <div className={styles.presetButtons}>
                    <button
                      type="button"
                      className={selectedDeliveryPreset === "late" ? styles.presetActive : ""}
                      onClick={() => {
                        setSelectedDeliveryPreset("late");
                        setDeliveryMinutes(50);
                        setDeliveryInput("۵۰");
                      }}
                    >
                      دیرتر (۵۰ د)
                    </button>
                    <button
                      type="button"
                      className={selectedDeliveryPreset === "match" ? styles.presetActive : ""}
                      onClick={() => {
                        setSelectedDeliveryPreset("match");
                        setDeliveryMinutes(requestedMinutes);
                        setDeliveryInput(formatNumber(requestedMinutes));
                      }}
                    >
                      مطابق کارفرما ({formatNumber(requestedMinutes)} د)
                    </button>
                    <button
                      type="button"
                      className={selectedDeliveryPreset === "fast" ? styles.presetActive : ""}
                      onClick={() => {
                        setSelectedDeliveryPreset("fast");
                        setDeliveryMinutes(30);
                        setDeliveryInput("۳۰");
                      }}
                    >
                      سریع‌تر (۳۰ د)
                    </button>
                  </div>
                </div>
              </section>

              <section
                className={`${styles.sectionCard} ${styles.messageCard}`}
                aria-labelledby="bid-message-heading"
              >
                <div className={styles.sectionHeading}>
                  <span className={styles.stepNumber}>۳</span>
                  <h3 id="bid-message-heading">پیام و توضیحات به کارفرما:</h3>
                </div>
                <textarea
                  className={styles.messageInput}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={500}
                  aria-label="پیام و توضیحات به کارفرما"
                />
                <div className={styles.characterCount}>
                  {formatNumber(message.length)} کاراکتر
                </div>
              </section>

              <section
                className={styles.validityCard}
                aria-labelledby="bid-validity-heading"
              >
                <span className={styles.validityDefault}>
                  {formatNumber(validityDays)} روز {validityDays === 2 ? "(پیش‌فرض)" : ""}
                </span>
                <div className={styles.validityControl}>
                  <label htmlFor="vaka-bid-validity" id="bid-validity-heading">
                    <span className={styles.stepNumber}>۴</span>
                    اعتبار پیشنهاد:
                  </label>
                  <input
                    id="vaka-bid-validity"
                    type="text"
                    inputMode="numeric"
                    value={validityInput}
                    onFocus={() => setValidityInput(formatNumber(validityDays))}
                    onChange={(event) => {
                      const localizedValue = toPersianDigits(event.target.value);
                      const next = parseNumericInput(localizedValue);
                      setValidityDays(next);
                      setValidityInput(localizedValue);
                    }}
                    onBlur={() => {
                      if (!validityInput.trim()) {
                        setValidityDays(2);
                        setValidityInput("۲");
                      } else {
                        setValidityInput(formatNumber(validityDays));
                      }
                    }}
                    aria-label="اعتبار پیشنهاد به روز"
                  />
                  <span>روز</span>
                </div>
              </section>

              {error ? (
                <p className={styles.formError} role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <footer className={styles.formFooter}>
              <label className={styles.termsLabel}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span className={styles.customCheckbox}>
                  {acceptedTerms ? <Icon name="check" size={12} /> : null}
                </span>
                <span>قوانین امانتداری واکا و سلامت کالا را تضمین و می‌پذیرم.</span>
              </label>

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "در حال ثبت..." : "ثبت و ارسال پیشنهاد"}
                  <Icon name="arrow" size={15} />
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  انصراف
                </button>
              </div>
            </footer>
          </form>
        </section>
      ) : (
        <section
          ref={dialogRef}
          className={`${styles.modal} ${styles.successModal}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vaka-bid-success-title"
          dir="rtl"
        >
          <header className={styles.successHeader}>
            {closeButton}
            <div className={styles.successHeaderMeta}>
              <span className={styles.successBadge}>
                ثبت موفقیت‌آمیز
                <span className={styles.successBadgeIcon}>
                  <Icon name="check" size={12} />
                </span>
              </span>
              <div className={styles.trackingCode}>
                <span>کد پیگیری:</span>
                <b dir="ltr">{trackingCode}</b>
              </div>
            </div>
          </header>

          <div className={styles.successBody}>
            <div className={styles.successIntro}>
              <div className={styles.successSeal}>
                <svg viewBox="0 0 32 32" width="30" height="30" fill="none" aria-hidden="true">
                  <path
                    d="m16 2.5 3.4 2.2 4-.2 1.7 3.6 3.5 1.9-.7 4.1 1.6 3.8-2.8 3.1-.4 4.1-4 1.1-2.3 3.4-4-1.2-4 1.2-2.3-3.4-4-1.1-.4-4.1-2.8-3.1 1.6-3.8-.7-4.1 3.5-1.9 1.7-3.6 4 .2L16 2.5Z"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="m10.5 16.2 3.6 3.5 7.6-7.8"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 id="vaka-bid-success-title">
                {result?.demo
                  ? "پیشنهاد شما با موفقیت ثبت شد!"
                  : "پیشنهاد شما با موفقیت برای کارفرما ارسال شد!"}
              </h2>
              <div className={styles.statusPill}>
                <span className={styles.statusDot} />
                وضعیت: {result?.statusText || "در انتظار بررسی و تأیید کارفرما"}
              </div>
              {result?.demo ? (
                <p className={styles.demoNotice}>
                  نسخه نمایشی: پیشنهاد در مرورگر ذخیره شده و هنوز به سرور یا کارفرما ارسال نشده است.
                </p>
              ) : null}
            </div>

            <section className={styles.successSummary}>
              <div className={styles.summaryHeader}>
                <div className={styles.summaryTask}>
                  <span className={styles.summaryIcon}>
                    <Icon name="receipt" size={18} />
                  </span>
                  <div>
                    <span>تسک انتخابی</span>
                    <strong>{task.title}</strong>
                  </div>
                </div>
                <span className={styles.summaryOrder}>سفارش #{orderCode}</span>
              </div>

              <div className={styles.summaryTiles}>
                <div className={styles.summaryTile}>
                  <div className={styles.summaryTileLabel}>
                    <Icon name="wallet" size={15} />
                    مبلغ ثبت‌شده شما:
                  </div>
                  <strong>{formatMoney(amount)} تومان</strong>
                  <span>(خالص دریافتی: {formatMoney(netAmount)} ت)</span>
                </div>
                <div className={styles.summaryTile}>
                  <div className={styles.summaryTileLabel}>
                    <Icon name="bolt" size={15} />
                    زمان و تحویل:
                  </div>
                  <strong>{deliveryLabel}</strong>
                </div>
              </div>
            </section>
          </div>

          <footer className={styles.successFooter}>
            <button
              type="button"
              className={styles.trackButton}
              onClick={handleTrackMyTasks}
            >
              پیگیری در تسک‌های من
              <span aria-hidden="true">◉</span>
            </button>
            <button
              type="button"
              className={styles.browseButton}
              onClick={handleBrowseTasks}
            >
              مشاهده سایر فرصت‌های شغلی
              <span aria-hidden="true">⌕</span>
            </button>
          </footer>
        </section>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
