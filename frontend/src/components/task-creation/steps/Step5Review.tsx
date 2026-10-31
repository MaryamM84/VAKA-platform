"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskFormData } from "../types";

type Props = {
  data: TaskFormData;
  onEditStep: (step: number) => void;
  onBack: () => void;
};

// تبدیل اعداد فارسی و عربی به انگلیسی برای پردازش
function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

// تبدیل اعداد انگلیسی به فارسی برای نمایش
function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

// نمایش متن با اعداد فارسی، بدون تغییر مقدار اصلی
function formatText(value: string | undefined): string {
  if (!value) return "";

  return toPersianDigits(value);
}

function formatNumber(value: string | number | undefined): string {
  const normalized = normalizeDigits(String(value ?? "0"));
  const number = Number(normalized.replace(/[,\s٬،]/g, ""));

  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0);
}

function formatDate(value: string | undefined): string {
  if (!value) return "ثبت نشده";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return formatText(value);
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Icon({
  name,
}: {
  name: "edit" | "clock" | "pin" | "wallet" | "check" | "lock" | "file";
}) {
  const content = {
    edit: (
      <>
        <path d="m15 5 4 4" />
        <path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="15" rx="3" />
        <path d="M3 10h18M16 15h2" />
        <path d="M6 6V4h12" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    file: (
      <>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5M10 13h6M10 17h6" />
      </>
    ),
  };

  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {content[name]}
    </svg>
  );
}

function SectionHeader({
  title,
  icon,
  onEdit,
}: {
  title: string;
  icon: "edit" | "clock" | "pin" | "wallet" | "file";
  onEdit: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--vaka-primary)]">
        <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--vaka-primary-soft)] text-[var(--vaka-primary)]">
          <Icon name={icon} />
        </span>
        {title}
      </h2>

      <button
        type="button"
        onClick={onEdit}
        className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[var(--vaka-primary)] hover:text-[var(--vaka-primary-hover)]"
      >
        <Icon name="edit" />
        ویرایش
      </button>
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-surface)] px-3 py-3">
      <p className="text-[10px] text-[var(--vaka-text-muted)]">{label}</p>

      <p className="mt-1 break-words text-xs font-bold leading-6 text-[var(--vaka-text)]">
        {formatText(value) || "ثبت نشده"}
      </p>
    </div>
  );
}

function ReviewMap({ data }: { data: TaskFormData }) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;

    async function createMap() {
      if (!elementRef.current) return;

      try {
        const L = await import("leaflet");

        if (disposed || !elementRef.current) return;

        const isRoute = data.locationMode === "route";

        const points: [number, number][] = [];

        if (isRoute) {
          if (
            data.originLatitude &&
            data.originLongitude &&
            Number.isFinite(Number(data.originLatitude)) &&
            Number.isFinite(Number(data.originLongitude))
          ) {
            points.push([
              Number(data.originLatitude),
              Number(data.originLongitude),
            ]);
          }

          if (
            data.destinationLatitude &&
            data.destinationLongitude &&
            Number.isFinite(Number(data.destinationLatitude)) &&
            Number.isFinite(Number(data.destinationLongitude))
          ) {
            points.push([
              Number(data.destinationLatitude),
              Number(data.destinationLongitude),
            ]);
          }
        } else if (
          data.locationLatitude &&
          data.locationLongitude &&
          Number.isFinite(Number(data.locationLatitude)) &&
          Number.isFinite(Number(data.locationLongitude))
        ) {
          points.push([
            Number(data.locationLatitude),
            Number(data.locationLongitude),
          ]);
        }

        const center: [number, number] =
          points.length > 0 ? points[0] : [35.7002, 51.337];

        map = L.map(elementRef.current, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
        }).setView(center, points.length > 0 ? 14 : 11);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);

        if (points.length === 1) {
          L.circleMarker(points[0], {
            radius: 8,
            color: "#ffffff",
            weight: 3,
            fillColor: "#006557",
            fillOpacity: 1,
          }).addTo(map);
        }

        if (points.length === 2) {
          L.circleMarker(points[0], {
            radius: 8,
            color: "#ffffff",
            weight: 3,
            fillColor: "#006557",
            fillOpacity: 1,
          }).addTo(map);

          L.circleMarker(points[1], {
            radius: 8,
            color: "#ffffff",
            weight: 3,
            fillColor: "#c87925",
            fillOpacity: 1,
          }).addTo(map);

          L.polyline(points, {
            color: "#006557",
            weight: 3,
            opacity: 0.85,
            dashArray: "6 6",
          }).addTo(map);

          map.fitBounds(L.latLngBounds(points).pad(0.3), {
            maxZoom: 14,
          });
        }

        setTimeout(() => {
          if (!disposed) map?.invalidateSize();
        }, 100);
      } catch {
        if (!disposed) setMapError(true);
      }
    }

    void createMap();

    return () => {
      disposed = true;
      map?.remove();
      map = null;
    };
  }, [
    data.locationMode,
    data.locationLatitude,
    data.locationLongitude,
    data.originLatitude,
    data.originLongitude,
    data.destinationLatitude,
    data.destinationLongitude,
  ]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-primary-pale)]">
      <div
        ref={elementRef}
        className="h-[190px] w-full sm:h-[220px]"
        aria-label="نمایش نقشه موقعیت سفارش"
      />

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--vaka-primary-pale)] p-4 text-center text-xs leading-6 text-[var(--vaka-text-secondary)]">
          نقشه بارگذاری نشد. نشانی و مختصات ثبت‌شده در اطلاعات سفارش قابل مشاهده
          است.
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 right-2 rounded-lg bg-[var(--vaka-surface)]/95 px-3 py-2 text-[10px] font-medium text-[var(--vaka-primary)] shadow-sm">
        {data.locationMode === "route"
          ? "نمایش مسیر مبدأ تا مقصد"
          : "موقعیت محل انجام کار"}
      </div>
    </div>
  );
}

export default function Step5Review({ data, onEditStep, onBack }: Props) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [feedback, setFeedback] = useState("");

  const isRoute = data.locationMode === "route";
  const needsGoods = data.goodsPurchaseRequired === "true";

  const wage = Math.max(
    0,
    Number(normalizeDigits(data.wageBudgetAmount || "0")) || 0,
  );

  const itemBudget = needsGoods
    ? Math.max(0, Number(normalizeDigits(data.itemCostCapAmount || "0")) || 0)
    : 0;

  const total = wage + itemBudget;

  const urgencyLabels: Record<string, string> = {
    normal: "عادی",
    urgent: "فوری",
    emergency: "اضطراری",
    low: "عادی",
    high: "فوری",
  };

  return (
    <div dir="rtl" className="space-y-3 sm:space-y-4">
      {/* عنوان صفحه */}
      <section className="pb-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full bg-[var(--vaka-primary-soft)] px-3 py-1 text-[10px] font-semibold text-[var(--vaka-primary)]">
              گام نهایی ایجاد سفارش
            </span>

            <h2 className="mt-3 text-lg font-extrabold text-[var(--vaka-text)] sm:text-xl">
              بازبینی نهایی و انتشار کار در شبکه واکا
            </h2>
          </div>

          <span className="rounded-full bg-[var(--vaka-primary-soft)] px-3 py-1.5 text-[10px] font-semibold text-[var(--vaka-primary)]">
            آماده بررسی نهایی
          </span>
        </div>

        <p className="mt-2 text-xs leading-6 text-[var(--vaka-text-secondary)]">
          اطلاعات واردشده را بررسی کنید. پس از انتشار، اعلان سفارش برای متخصصان
          واجد شرایط ارسال می‌شود.
        </p>
      </section>

      {/* ۱. مشخصات و عنوان کار */}
      <section className="rounded-2xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-primary-pale)] p-3 sm:p-4">
        <SectionHeader
          title="مشخصات و عنوان کار"
          icon="edit"
          onEdit={() => onEditStep(0)}
        />

        <div className="rounded-xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-surface)] p-3 sm:p-4">
          <p className="text-[10px] text-[var(--vaka-text-muted)]">
            عنوان درخواست
          </p>

          <h3 className="mt-1 text-sm font-extrabold leading-7 text-[var(--vaka-text)]">
            {formatText(data.title) || "عنوان کار ثبت نشده است"}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--vaka-primary-soft)] px-3 py-1.5 text-[10px] font-semibold text-[var(--vaka-primary)]">
              {formatText(data.categoryName) || "دسته‌بندی مشخص نشده"}
            </span>
          </div>

          <div className="mt-3 border-t border-[var(--vaka-border-soft)] pt-3">
            <p className="text-[11px] font-bold text-[var(--vaka-primary)]">
              شرح دقیق مأموریت:
            </p>

            <p className="mt-1 whitespace-pre-wrap text-xs leading-7 text-[var(--vaka-text-secondary)]">
              {formatText(data.description) ||
                "توضیحی برای این کار ثبت نشده است."}
            </p>
          </div>

          {data.deliveryCriteria && (
            <div className="mt-3 rounded-xl bg-[var(--vaka-primary-pale)] p-3">
              <p className="text-[11px] font-bold text-[var(--vaka-primary)]">
                معیار تحویل و تأیید:
              </p>

              <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-[var(--vaka-text-secondary)]">
                {formatText(data.deliveryCriteria)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ۲. زمان‌بندی و فوریت */}
      <section className="rounded-2xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-primary-pale)] p-3 sm:p-4">
        <SectionHeader
          title="زمان‌بندی و فوریت"
          icon="clock"
          onEdit={() => onEditStep(1)}
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SummaryValue
            label="فوریت کار"
            value={
              urgencyLabels[data.urgency] || formatText(data.urgency) || "عادی"
            }
          />

          <SummaryValue
            label="مدت زمان تخمینی"
            value={
              data.estimatedDurationMinutes
                ? `${formatNumber(data.estimatedDurationMinutes)} دقیقه`
                : "ثبت نشده"
            }
          />

          <SummaryValue
            label="مهلت ارسال پیشنهاد"
            value={formatDate(data.proposalDeadlineAt)}
          />
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <SummaryValue
            label="زمان شروع یا بازه اجرای کار"
            value={formatDate(data.executionStartTime || data.deadlineAt)}
          />

          <SummaryValue
            label="پایان بازه اجرا"
            value={formatDate(data.executionWindowEndAt)}
          />
        </div>
      </section>

      {/* ۳. محدوده جغرافیایی */}
      <section className="rounded-2xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-primary-pale)] p-3 sm:p-4">
        <SectionHeader
          title="محدوده جغرافیایی و حریم خصوصی"
          icon="pin"
          onEdit={() => onEditStep(2)}
        />

        {isRoute ? (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <SummaryValue
              label="مبدأ (محل شروع / تحویل کالا)"
              value={data.originAddress || "مبدأ ثبت نشده است"}
            />

            <SummaryValue
              label="مقصد (محل تحویل‌گیرنده)"
              value={data.destinationAddress || "مقصد ثبت نشده است"}
            />
          </div>
        ) : (
          <div className="mb-3">
            <SummaryValue
              label="آدرس محل انجام کار"
              value={data.locationAddress || "نشانی ثبت نشده است"}
            />
          </div>
        )}

        <ReviewMap data={data} />

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--vaka-surface)] p-3">
          <span className="mt-0.5 text-[var(--vaka-primary)]">
            <Icon name="lock" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[var(--vaka-primary)]">
              اطلاعات محرمانه محل
            </p>

            <p className="mt-1 text-[11px] leading-6 text-[var(--vaka-text-secondary)]">
              پلاک: {formatText(data.locationBuilding) || "ثبت نشده"}{" "}
              <span className="mx-1">|</span>
              طبقه / واحد: {formatText(data.locationUnit) || "ثبت نشده"}
            </p>

            {data.locationDeliveryNotes && (
              <p className="mt-1 text-[11px] leading-6 text-[var(--vaka-text-secondary)]">
                توضیح تحویل: {formatText(data.locationDeliveryNotes)}
              </p>
            )}

            <p className="mt-1 text-[10px] leading-5 text-[var(--vaka-text-muted)]">
              اطلاعات اختصاصی باید در زمان مناسب و فقط در اختیار افراد مجاز قرار
              گیرد.
            </p>
          </div>
        </div>
      </section>

      {/* ۴. بودجه و صندوق امانت */}
      <section className="rounded-2xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-primary-pale)] p-3 sm:p-4">
        <SectionHeader
          title="بودجه مالی و صندوق امانت واکا"
          icon="wallet"
          onEdit={() => onEditStep(3)}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-surface)] px-3 py-3">
            <span className="text-xs text-[var(--vaka-text-secondary)]">
              دستمزد خالص مجری
            </span>

            <strong className="text-xs text-[var(--vaka-text)]">
              {formatNumber(wage)} تومان
            </strong>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-surface)] px-3 py-3">
            <span className="text-xs text-[var(--vaka-text-secondary)]">
              سقف هزینه خرید اقلام
            </span>

            <strong className="text-xs text-[var(--vaka-text)]">
              {formatNumber(itemBudget)} تومان
            </strong>
          </div>

          <div className="rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-primary-soft)] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[var(--vaka-primary)]">
                مجموع سپرده اولیه سفارش
              </span>

              <span className="text-lg font-extrabold text-[var(--vaka-primary)]">
                {formatNumber(total)} تومان
              </span>
            </div>

            <p className="mt-2 text-[10px] leading-5 text-[var(--vaka-text-secondary)]">
              مبلغ بر اساس دستمزد و بودجه خرید انتخاب‌شده محاسبه شده است. مبلغ
              واقعی قابل پرداخت باید در مرحله ثبت سفارش و با توجه به شرایط مالی
              سامانه تأیید شود.
            </p>
          </div>
        </div>
      </section>

      {/* ۵. تأیید شرایط */}
      <section className="rounded-xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-primary-pale)] p-3 sm:p-4">
        <label
          htmlFor="review-accept-terms"
          className="flex cursor-pointer items-start gap-3"
        >
          <input
            id="review-accept-terms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => {
              setAcceptedTerms(event.target.checked);
              setFeedback("");
            }}
            className="mt-1 size-4 shrink-0 accent-[var(--vaka-primary)]"
          />

          <span className="min-w-0">
            <span className="block text-xs font-bold leading-6 text-[var(--vaka-text)]">
              قوانین و شرایط شبکه واکا را مطالعه کرده‌ام و می‌پذیرم.
            </span>

            <span className="mt-1 block text-[10px] leading-5 text-[var(--vaka-text-muted)]">
              با انتشار کار، اطلاعات ثبت‌شده برای ارائه پیشنهاد در اختیار
              متخصصان واجد شرایط قرار می‌گیرد. اطلاعات محرمانه باید مطابق
              سیاست‌های دسترسی سامانه محافظت شود.
            </span>
          </span>
        </label>

        {feedback && (
          <p
            role="status"
            className="mt-3 rounded-lg bg-[var(--vaka-primary-soft)] px-3 py-2 text-xs leading-6 text-[var(--vaka-primary)]"
          >
            {formatText(feedback)}
          </p>
        )}
      </section>

      {/* دکمه‌های نهایی */}
      <footer className="flex flex-col gap-3 border-t border-[var(--vaka-border-soft)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="order-3 inline-flex items-center justify-center gap-2 rounded-full border border-[var(--vaka-border)] bg-[var(--vaka-surface)] px-5 py-3 text-xs font-semibold text-[var(--vaka-text)] transition hover:bg-[var(--vaka-primary-pale)] sm:order-1"
        >
          بازگشت به بودجه و دستمزد
        </button>

        <button
          type="button"
          onClick={() =>
            setFeedback(
              "پیش‌نویس در این نسخه نمایشی آماده است؛ ذخیره دائمی به API نیاز دارد.",
            )
          }
          className="order-2 inline-flex items-center justify-center gap-2 rounded-full border border-[var(--vaka-border)] bg-[var(--vaka-surface)] px-5 py-3 text-xs font-semibold text-[var(--vaka-text)] transition hover:bg-[var(--vaka-primary-pale)] sm:order-2"
        >
          <Icon name="file" />
          ذخیره به عنوان پیش‌نویس
        </button>

        <button
          type="button"
          disabled={!acceptedTerms}
          onClick={() => {
            if (!acceptedTerms) return;

            setFeedback(
              "تأیید اولیه انجام شد. برای انتشار واقعی، اتصال API ثبت سفارش لازم است.",
            );
          }}
          className="order-1 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--vaka-primary)] px-5 py-3 text-xs font-bold text-[var(--vaka-surface)] shadow-md shadow-[var(--vaka-primary)]/15 transition hover:bg-[var(--vaka-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40 sm:order-3"
        >
          <Icon name="check" />
          انتشار عمومی کار و دریافت پیشنهاد مجریان
        </button>
      </footer>
    </div>
  );
}
