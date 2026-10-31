"use client";

import { useState } from "react";
import type { TaskFormData } from "../types";

interface Step4BudgetProps {
  data: TaskFormData;
  onChange: (field: keyof TaskFormData, value: string) => void;
}

const inputClassName =
  "w-full min-w-0 border-0 bg-transparent px-4 py-3 text-left text-lg font-bold tracking-wide text-[var(--vaka-text)] outline-none placeholder:text-[var(--vaka-text-muted)]";

const labelClassName = "block text-sm font-bold text-[var(--vaka-primary)]";

const MIN_WAGE = 50000;

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\d]/g, "");
}

function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function formatToman(value: string | number): string {
  const amount = Number(value);

  return new Intl.NumberFormat("fa-IR", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatInputAmount(value: string): string {
  const normalized = normalizeDigits(value);

  if (!normalized) return "";

  return formatToman(normalized);
}

export default function Step4Budget({ data, onChange }: Step4BudgetProps) {
  const [touched, setTouched] = useState({
    wage: false,
    itemBudget: false,
  });

  const wage = Math.max(0, Number(normalizeDigits(data.wageBudgetAmount)) || 0);

  const itemBudget = Math.max(
    0,
    Number(normalizeDigits(data.itemCostCapAmount)) || 0,
  );

  const needsGoods = data.goodsPurchaseRequired === "true";

  const total = wage + (needsGoods ? itemBudget : 0);

  const wageError =
    touched.wage && wage < MIN_WAGE
      ? "حداقل دستمزد مجاز ۵۰٬۰۰۰ تومان است."
      : "";

  const itemBudgetError =
    touched.itemBudget && needsGoods && itemBudget <= 0
      ? "لطفاً سقف هزینه خرید اقلام را وارد کنید."
      : "";

  const handleAmountChange = (
    field: "wageBudgetAmount" | "itemCostCapAmount",
    value: string,
  ) => {
    // مقدار داخلی همیشه با ارقام انگلیسی ذخیره می‌شود.
    onChange(field, normalizeDigits(value));
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* ۱. دستمزد خالص مجری */}
      <section className="rounded-2xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-primary-pale)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={labelClassName}>
            <span className="ml-2 text-[var(--vaka-primary)]">●</span>
            دستمزد خالص مجری
            <span className="mr-1 text-xs font-medium text-[var(--vaka-text-secondary)]">
              (Service Compensation)
            </span>
          </h2>

          <span className="text-[10px] text-[var(--vaka-text-muted)]">
            حداقل دستمزد مجاز: ۵۰٬۰۰۰ تومان
          </span>
        </div>

        <div className="mt-3 flex items-center rounded-xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-surface)] px-4">
          <span className="shrink-0 text-xs text-[var(--vaka-text-secondary)]">
            تومان
          </span>

          <input
            id="wage-budget"
            type="text"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            value={formatInputAmount(data.wageBudgetAmount)}
            onChange={(event) =>
              handleAmountChange("wageBudgetAmount", event.target.value)
            }
            onBlur={() =>
              setTouched((previous) => ({
                ...previous,
                wage: true,
              }))
            }
            aria-label="دستمزد خالص مجری به تومان"
            aria-invalid={Boolean(wageError)}
            aria-describedby="wage-budget-help"
            placeholder="۲۵۰٬۰۰۰"
            className={inputClassName}
          />

          <span
            className="text-lg text-[var(--vaka-primary)]"
            aria-hidden="true"
          >
            ▣
          </span>
        </div>

        {wageError && (
          <p className="mt-2 text-xs text-[var(--vaka-danger)]" role="alert">
            {wageError}
          </p>
        )}

        <div
          id="wage-budget-help"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] leading-5 text-[var(--vaka-text-muted)]"
        >
          <span>مبلغ خالص دریافتی مجری پس از پایان مأموریت</span>

          <span className="font-medium text-[var(--vaka-primary)]">
            معادل دستمزد و پاداش نرخ‌گذاری
          </span>
        </div>
      </section>

      {/* ۲. پیشنهاد هوشمند هوش مصنوعی */}
      <section className="rounded-2xl border border-[var(--vaka-primary-soft)] bg-[var(--vaka-primary-pale)] p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--vaka-warning)]/10 text-xl text-[var(--vaka-warning)]">
            ✨
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-[var(--vaka-text)]">
                برآورد هوشمند دستمزد
              </h2>

              <span className="rounded-full bg-[var(--vaka-warning)]/15 px-2 py-1 text-[10px] font-bold text-[var(--vaka-warning)]">
                دقت ۷۹٪
              </span>
            </div>

            <p className="mt-1 text-xs leading-6 text-[var(--vaka-text-secondary)]">
              پیشنهاد دستمزد بر اساس زمان انجام کار، فوریت، خرید و ترافیک منطقه.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[var(--vaka-text-secondary)]">
            مبلغ پیشنهادی سیستم
          </span>

          <span className="text-sm font-extrabold text-[var(--vaka-primary)]">
            {formatToman(250000)} تومان
          </span>
        </div>

        <p className="mt-2 text-[10px] leading-5 text-[var(--vaka-text-muted)]">
          این مبلغ فعلاً ثابت و نمایشی است و بعداً به سرویس هوش مصنوعی متصل
          خواهد شد.
        </p>
      </section>

      {/* ۳. بودجه خرید اقلام */}
      <section className="rounded-2xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-primary-pale)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={labelClassName}>
            <span className="ml-2 text-[var(--vaka-primary)]">●</span>
            بودجه خرید اقلام
            <span className="mr-1 text-xs font-medium text-[var(--vaka-text-secondary)]">
              (Goods Purchase Budget)
            </span>
          </h2>

          <label
            htmlFor="goods-purchase-required"
            className="flex cursor-pointer items-center gap-2 text-xs text-[var(--vaka-text)]"
          >
            <span>نیاز به خرید کالا دارد</span>

            <input
              id="goods-purchase-required"
              type="checkbox"
              checked={needsGoods}
              onChange={(event) => {
                onChange(
                  "goodsPurchaseRequired",
                  event.target.checked ? "true" : "false",
                );

                if (event.target.checked) {
                  setTouched((previous) => ({
                    ...previous,
                    itemBudget: false,
                  }));
                }
              }}
              className="peer sr-only"
            />

            <span
              aria-hidden="true"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                needsGoods
                  ? "bg-[var(--vaka-primary)]"
                  : "bg-[var(--vaka-border)]"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-[var(--vaka-surface)] shadow-sm transition-all ${
                  needsGoods ? "right-0.5" : "right-[22px]"
                }`}
              />
            </span>
          </label>
        </div>

        <p className="mt-2 text-xs leading-6 text-[var(--vaka-text-muted)]">
          هزینه اقلامی که مجری باید برای انجام مأموریت خریداری کند.
        </p>

        {needsGoods ? (
          <div className="mt-4 rounded-xl bg-[var(--vaka-surface)] p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="item-cost-cap"
                className="text-sm font-bold text-[var(--vaka-text)]"
              >
                سقف هزینه خرید اقلام توسط مجری
                <span className="mr-1 text-[var(--vaka-danger)]">*</span>
              </label>

              <span className="text-[10px] text-[var(--vaka-warning)]">
                تسویه بر اساس فاکتور دقیق
              </span>
            </div>

            <div className="mt-3 flex items-center rounded-xl border border-[var(--vaka-border-soft)] bg-[var(--vaka-primary-soft)] px-3">
              <span className="shrink-0 text-xs text-[var(--vaka-text-secondary)]">
                تومان
              </span>

              <input
                id="item-cost-cap"
                type="text"
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                value={formatInputAmount(data.itemCostCapAmount)}
                onChange={(event) =>
                  handleAmountChange("itemCostCapAmount", event.target.value)
                }
                onBlur={() =>
                  setTouched((previous) => ({
                    ...previous,
                    itemBudget: true,
                  }))
                }
                aria-label="سقف بودجه خرید اقلام به تومان"
                aria-invalid={Boolean(itemBudgetError)}
                placeholder="۱۸۰٬۰۰۰"
                className="w-full min-w-0 bg-transparent px-4 py-3 text-left text-base font-bold text-[var(--vaka-text)] outline-none placeholder:text-[var(--vaka-text-muted)]"
              />

              <span
                className="text-lg text-[var(--vaka-warning)]"
                aria-hidden="true"
              >
                ▤
              </span>
            </div>

            {itemBudgetError && (
              <p
                className="mt-2 text-xs text-[var(--vaka-danger)]"
                role="alert"
              >
                {itemBudgetError}
              </p>
            )}

            <p className="mt-2 text-[10px] leading-5 text-[var(--vaka-text-muted)]">
              مجری موظف است حداکثر تا سقف تعیین‌شده، هزینه اقلام را بدون هماهنگی
              قبلی تغییر ندهد.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--vaka-border)] bg-[var(--vaka-surface)]/70 p-4 text-xs leading-6 text-[var(--vaka-text-secondary)]">
            برای این کار بودجه جداگانه‌ای جهت خرید کالا در نظر گرفته نشده است.
          </div>
        )}

        {/* الزام ارائه فاکتور */}
        <label
          htmlFor="invoice-required"
          className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-surface)] p-3 sm:p-4"
        >
          <input
            id="invoice-required"
            type="checkbox"
            checked={data.invoiceRequired === "true"}
            onChange={(event) =>
              onChange(
                "invoiceRequired",
                event.target.checked ? "true" : "false",
              )
            }
            className="mt-1 size-4 shrink-0 accent-[var(--vaka-primary)]"
          />

          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-[var(--vaka-text)]">
              الزام ارائه و بارگذاری فاکتور رسمی قبل از تسویه نهایی
            </span>

            <span className="mt-1 block text-[10px] leading-5 text-[var(--vaka-text-muted)]">
              مجری باید فاکتور خرید اقلام را برای بررسی و تأیید هزینه‌ها ارائه
              کند.
            </span>
          </span>

          <span
            className="text-base text-[var(--vaka-primary)]"
            aria-hidden="true"
          >
            ▣
          </span>
        </label>
      </section>

      {/* ۴. صندوق امانت */}
      <section className="overflow-hidden rounded-2xl border border-[var(--vaka-primary)] bg-gradient-to-br from-[var(--vaka-primary)] to-[var(--vaka-primary-hover)] p-4 text-[var(--vaka-surface)] shadow-lg shadow-[var(--vaka-primary)]/15 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--vaka-surface)]/10 text-2xl text-[var(--vaka-warning)]">
            ♜
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-[var(--vaka-surface)]/70">
              مبلغ نهایی مورد نیاز برای ثبت سفارش
            </p>

            <h2 className="mt-1 text-sm font-bold">
              صندوق امانت سپرده واکا
              <span className="mr-1 text-[10px] font-medium text-[var(--vaka-surface)]/75">
                (Escrow Commitment)
              </span>
            </h2>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--vaka-surface)]/15 bg-[var(--vaka-surface)]/5 p-4">
          <p className="text-[10px] text-[var(--vaka-surface)]/70">
            جمع کل سپرده مورد نیاز سفارش
          </p>

          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <strong
              className="text-3xl font-extrabold tracking-tight sm:text-4xl"
              aria-live="polite"
            >
              {formatToman(total)}
            </strong>

            <span className="text-xs text-[var(--vaka-surface)]/80">تومان</span>
          </div>

          <div className="mt-3 border-t border-[var(--vaka-surface)]/15 pt-3 text-[10px] leading-6 text-[var(--vaka-surface)]/75">
            <p>دستمزد مجری: {formatToman(wage)} تومان</p>

            <p>
              بودجه خرید کالا: {formatToman(needsGoods ? itemBudget : 0)} تومان
            </p>
          </div>
        </div>

        <p className="mt-3 text-[10px] leading-5 text-[var(--vaka-surface)]/75">
          مبلغ سپرده برای انجام سفارش در صندوق امانت نگهداری می‌شود. تسویه نهایی
          مطابق شرایط سفارش و پس از بررسی انجام خواهد شد.
        </p>
      </section>
    </div>
  );
}
