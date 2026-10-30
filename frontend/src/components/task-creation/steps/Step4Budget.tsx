"use client";

import type { TaskFormData } from "../types";

interface Step4BudgetProps {
  data: TaskFormData;
  onChange: (field: keyof TaskFormData, value: string) => void;
}

const inputClassName =
  "w-full min-w-0 rounded-xl border border-[#e1ebe5] bg-white px-4 py-3 text-sm text-[#182522] outline-none transition placeholder:text-[#a0aaa5] focus:border-[#087d6c] focus:ring-2 focus:ring-[#087d6c]/10";

const labelClassName = "block text-sm font-bold text-[#174f46]";

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\d]/g, "");
}

function formatToman(value: string | number): string {
  const amount = Number(value);

  return new Intl.NumberFormat("fa-IR").format(
    Number.isFinite(amount) ? amount : 0,
  );
}

export default function Step4Budget({ data, onChange }: Step4BudgetProps) {
  const wage = Math.max(0, Number(normalizeDigits(data.wageBudgetAmount)) || 0);

  const itemBudget = Math.max(
    0,
    Number(normalizeDigits(data.itemCostCapAmount)) || 0,
  );

  const needsGoods = data.goodsPurchaseRequired === "true";

  const total = wage + (needsGoods ? itemBudget : 0);

  const handleAmountChange = (
    field: "wageBudgetAmount" | "itemCostCapAmount",
    value: string,
  ) => {
    onChange(field, normalizeDigits(value));
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* 1. دستمزد خالص مجری */}
      <section className="rounded-2xl border border-[#e8f0eb] bg-[#f0f8f4] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={labelClassName}>
            <span className="ml-2 text-[#087d6c]">●</span>
            دستمزد خالص مجری
            <span className="mr-1 text-xs font-medium text-[#64857a]">
              (Service Compensation)
            </span>
          </h2>

          <span className="text-[10px] text-[#81948b]">
            حداقل دستمزد مجاز: ۵۰٬۰۰۰ تومان
          </span>
        </div>

        <div className="mt-3 flex items-center rounded-xl border border-[#edf2ee] bg-white px-4">
          <span className="shrink-0 text-xs text-[#66766e]">تومان</span>

          <input
            id="wage-budget"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={data.wageBudgetAmount}
            onChange={(event) =>
              handleAmountChange("wageBudgetAmount", event.target.value)
            }
            aria-label="دستمزد خالص مجری به تومان"
            placeholder="۲۵۰٬۰۰۰"
            className="w-full min-w-0 border-0 bg-transparent px-4 py-3 text-center text-lg font-bold tracking-wide text-[#182522] outline-none"
          />

          <span className="text-lg text-[#087d6c]" aria-hidden="true">
            ▣
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] leading-5 text-[#81948b]">
          <span>مبلغ خالص دریافتی مجری پس از پایان مأموریت</span>

          <span className="font-medium text-[#287e6e]">
            معادل دستمزد و پاداش نرخ‌گذاری
          </span>
        </div>
      </section>

      {/* 2. پیشنهاد هوشمند هوش مصنوعی */}
      <section className="rounded-2xl border border-[#e4eee8] bg-[#edf8f4] p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#fff0df] text-xl text-[#a96328]">
            ✨
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-[#263b34]">
                برآورد هوشمند دستمزد
              </h2>

              <span className="rounded-full bg-[#ffe4ca] px-2 py-1 text-[10px] font-bold text-[#a85f28]">
                دقت ۷۹٪
              </span>
            </div>

            <p className="mt-1 text-xs leading-6 text-[#65766e]">
              پیشنهاد دستمزد بر اساس زمان انجام کار، فوریت، خرید و ترافیک منطقه.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#65766e]">مبلغ پیشنهادی سیستم</span>

          <span className="text-sm font-extrabold text-[#087d6c]">
            {formatToman(250000)} تومان
          </span>
        </div>

        <p className="mt-2 text-[10px] leading-5 text-[#81948b]">
          این مبلغ فعلاً ثابت و نمایشی است و بعداً به سرویس هوش مصنوعی متصل
          خواهد شد.
        </p>
      </section>

      {/* 3. بودجه خرید اقلام */}
      <section className="rounded-2xl border border-[#e8f0eb] bg-[#f0f8f4] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={labelClassName}>
            <span className="ml-2 text-[#087d6c]">●</span>
            بودجه خرید اقلام
            <span className="mr-1 text-xs font-medium text-[#64857a]">
              (Goods Purchase Budget)
            </span>
          </h2>

          <label
            htmlFor="goods-purchase-required"
            className="flex cursor-pointer items-center gap-2 text-xs text-[#354b42]"
          >
            <span>نیاز به خرید کالا دارد</span>

            <input
              id="goods-purchase-required"
              type="checkbox"
              checked={needsGoods}
              onChange={(event) =>
                onChange(
                  "goodsPurchaseRequired",
                  event.target.checked ? "true" : "false",
                )
              }
              className="peer sr-only"
            />

            <span
              aria-hidden="true"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                needsGoods ? "bg-[#087d6c]" : "bg-[#cbd7d0]"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all ${
                  needsGoods ? "right-0.5" : "right-[22px]"
                }`}
              />
            </span>
          </label>
        </div>

        <p className="mt-2 text-xs leading-6 text-[#819087]">
          هزینه اقلامی که مجری باید برای انجام مأموریت خریداری کند.
        </p>

        {needsGoods ? (
          <div className="mt-4 rounded-xl bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="item-cost-cap"
                className="text-sm font-bold text-[#263b34]"
              >
                سقف هزینه خرید اقلام توسط مجری
              </label>

              <span className="text-[10px] text-[#a66a3c]">
                تسویه بر اساس فاکتور دقیق
              </span>
            </div>

            <div className="mt-3 flex items-center rounded-xl border border-[#e3eee7] bg-[#edf7f2] px-3">
              <span className="shrink-0 text-xs text-[#66766e]">تومان</span>

              <input
                id="item-cost-cap"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={data.itemCostCapAmount}
                onChange={(event) =>
                  handleAmountChange("itemCostCapAmount", event.target.value)
                }
                aria-label="سقف بودجه خرید اقلام به تومان"
                placeholder="۱۸۰٬۰۰۰"
                className="w-full min-w-0 bg-transparent px-4 py-3 text-center text-base font-bold text-[#182522] outline-none"
              />

              <span className="text-lg text-[#9a693d]" aria-hidden="true">
                ▤
              </span>
            </div>

            <p className="mt-2 text-[10px] leading-5 text-[#819087]">
              مجری موظف است حداکثر تا سقف تعیین‌شده، هزینه اقلام را بدون هماهنگی
              قبلی تغییر ندهد.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-[#d5e5db] bg-white/70 p-4 text-xs leading-6 text-[#65766e]">
            برای این کار بودجه جداگانه‌ای جهت خرید کالا در نظر گرفته نشده است.
          </div>
        )}

        {/* الزام ارائه فاکتور */}
        <label
          htmlFor="invoice-required"
          className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#dcebe3] bg-white p-3 sm:p-4"
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
            className="mt-1 size-4 shrink-0 accent-[#087d6c]"
          />

          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-[#263b34]">
              الزام ارائه و بارگذاری فاکتور رسمی قبل از تسویه نهایی
            </span>

            <span className="mt-1 block text-[10px] leading-5 text-[#819087]">
              مجری باید فاکتور خرید اقلام را برای بررسی و تأیید هزینه‌ها ارائه
              کند.
            </span>
          </span>

          <span className="text-base text-[#087d6c]" aria-hidden="true">
            ▣
          </span>
        </label>
      </section>

      {/* 4. صندوق امانت */}
      <section className="overflow-hidden rounded-2xl border border-[#0d8b79] bg-gradient-to-br from-[#087c6d] to-[#006454] p-4 text-white shadow-lg shadow-[#006557]/15 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl text-[#d5c6a0]">
            ♜
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-white/70">
              مبلغ نهایی مورد نیاز برای ثبت سفارش
            </p>

            <h2 className="mt-1 text-sm font-bold">
              صندوق امانت سپرده واکا
              <span className="mr-1 text-[10px] font-medium text-white/75">
                (Escrow Commitment)
              </span>
            </h2>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-4">
          <p className="text-[10px] text-white/70">
            جمع کل سپرده مورد نیاز سفارش
          </p>

          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <strong
              className="text-3xl font-extrabold tracking-tight sm:text-4xl"
              aria-live="polite"
            >
              {formatToman(total)}
            </strong>

            <span className="text-xs text-white/80">تومان</span>
          </div>

          <div className="mt-3 border-t border-white/15 pt-3 text-[10px] leading-6 text-white/75">
            <p>دستمزد مجری: {formatToman(wage)} تومان</p>

            <p>
              بودجه خرید کالا: {formatToman(needsGoods ? itemBudget : 0)} تومان
            </p>
          </div>
        </div>

        <p className="mt-3 text-[10px] leading-5 text-white/75">
          مبلغ سپرده برای انجام سفارش در صندوق امانت نگهداری می‌شود. تسویه نهایی
          مطابق شرایط سفارش و پس از بررسی انجام خواهد شد.
        </p>
      </section>
    </div>
  );
}
