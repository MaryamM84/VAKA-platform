"use client";

import type { TaskFormData } from "../types";

interface Step1DetailsProps {
  data: TaskFormData;
  onChange: (field: keyof TaskFormData, value: string) => void;
}

const categories = [
  {
    name: "خریدهای فوری و پیک",
    description: "تهیه و خرید کالا، خرید روزمره و پیک اختصاصی",
    icon: "🛵",
  },
  {
    name: "نظافت و مرتب‌سازی",
    description: "امور نظافتی، چیدمان و پاک‌سازی فضاهای مختلف",
    icon: "🧹",
  },
  {
    name: "ایستادن در صف و اداری",
    description: "پیگیری کارهای اداری، صف‌های دولتی و بانکی",
    icon: "⏳",
  },
  {
    name: "تعمیرات و خدمات فنی",
    description: "خرده‌کاری تأسیسات، برقی، نصب و تعمیرات",
    icon: "🔧",
  },
  {
    name: "اسباب‌کشی و جابه‌جایی",
    description: "بسته‌بندی، جابه‌جایی وسایل سبک و کارهای حمل‌ونقل",
    icon: "🚚",
  },
  {
    name: "مراقبت و نگهداری",
    description: "گردش حیوانات، نگهداری موقت و مراقبت ویژه",
    icon: "🐾",
  },
];

const inputClassName =
  "w-full rounded-xl border border-[var(--vaka-border)] bg-[var(--vaka-surface)] px-4 py-3 text-sm text-[var(--vaka-text)] outline-none transition placeholder:text-[var(--vaka-text-muted)] focus:border-[var(--vaka-primary)] focus:ring-2 focus:ring-[var(--vaka-primary)]/10";

const labelClassName = "block text-sm font-bold text-[var(--vaka-primary)]";

export default function Step1Details({ data, onChange }: Step1DetailsProps) {
  return (
    <div className="space-y-7">
      {/* عنوان کار */}
      <section className="rounded-2xl bg-[var(--vaka-primary-pale)] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="task-title" className={labelClassName}>
            <span className="ml-2 text-[var(--vaka-primary)]">●</span>
            عنوان دقیق کار چیست؟
            <span className="mr-1 text-[var(--vaka-danger)]">*</span>
          </label>

          <span className="rounded-full bg-[var(--vaka-surface)] px-3 py-1 text-[11px] text-[var(--vaka-text-muted)]">
            {new Intl.NumberFormat("fa-IR").format(data.title.length)} / ۱۸۰ حرف
          </span>
        </div>

        <input
          id="task-title"
          type="text"
          value={data.title}
          onChange={(event) => onChange("title", event.target.value)}
          maxLength={180}
          required
          placeholder="مثلاً خرید گل و شیرینی از قنادی ناتالی"
          className={inputClassName}
        />

        <p className="mt-3 text-xs leading-6 text-[var(--vaka-text-muted)]">
          یک عنوان مختصر و صریح بنویسید تا متخصصان متوجه شوند دقیقاً چه کاری
          باید انجام شود.
        </p>
      </section>

      {/* دسته‌بندی کار */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className={labelClassName}>
            <span className="ml-2 text-[var(--vaka-primary)]">♧</span>
            دسته‌بندی مرتبط با کار را انتخاب کنید:
            <span className="mr-1 text-[var(--vaka-danger)]">*</span>
          </h3>

          <span className="text-xs text-[var(--vaka-text-muted)]">
            انتخاب یکی از ۶ دسته
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const isSelected = data.categoryName === category.name;

            return (
              <button
                key={category.name}
                type="button"
                onClick={() => onChange("categoryName", category.name)}
                aria-pressed={isSelected}
                className={`relative flex min-h-28 flex-col rounded-2xl border p-4 text-right transition ${
                  isSelected
                    ? "border-[var(--vaka-primary)] bg-[var(--vaka-primary-soft)] shadow-sm ring-1 ring-[var(--vaka-primary)]/20"
                    : "border-[var(--vaka-border-soft)] bg-[var(--vaka-surface)] hover:border-[var(--vaka-primary)] hover:bg-[var(--vaka-primary-pale)]"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span
                    className={`flex size-10 items-center justify-center rounded-xl text-xl ${
                      isSelected
                        ? "bg-[var(--vaka-primary)] text-white"
                        : "bg-[var(--vaka-primary-soft)]"
                    }`}
                    aria-hidden="true"
                  >
                    {category.icon}
                  </span>

                  <span
                    className={`flex size-5 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-[var(--vaka-primary)] bg-[var(--vaka-primary)] text-white"
                        : "border-[var(--vaka-border)] bg-[var(--vaka-surface)]"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && <span className="text-xs">✓</span>}
                  </span>
                </div>

                <span className="text-sm font-bold leading-6 text-[var(--vaka-text)]">
                  {category.name}
                </span>

                <span className="mt-1 text-xs leading-5 text-[var(--vaka-text-secondary)]">
                  {category.description}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs leading-6 text-[var(--vaka-text-muted)]">
          دسته‌بندی مناسب به پیدا کردن مجری مرتبط با کار شما کمک می‌کند.
        </p>
      </section>

      {/* شرح کامل کار */}
      <section className="rounded-2xl bg-[var(--vaka-primary-pale)] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="task-description" className={labelClassName}>
            <span className="ml-2 text-[var(--vaka-primary)]">●</span>
            شرح کامل کار و انتظارات دقیق
            <span className="mr-1 text-[var(--vaka-danger)]">*</span>
          </label>
        </div>

        <textarea
          id="task-description"
          value={data.description}
          onChange={(event) => onChange("description", event.target.value)}
          rows={6}
          required
          placeholder="لطفاً شرح دهید چه کاری باید انجام شود، چه جزئیاتی اهمیت دارند و چه نتیجه‌ای انتظار دارید..."
          className={`${inputClassName} resize-none leading-7`}
        />

        <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
          <p className="flex-1 text-xs leading-6 text-[var(--vaka-text-muted)]">
            <span className="ml-1 text-[var(--vaka-primary)]">ⓘ</span>
            ذکر جزئیات ابزار مورد نیاز و حساسیت کالا به قیمت‌گذاری بهتر کمک
            می‌کند.
          </p>
        </div>
      </section>

      {/* معیارهای تحویل کار */}
      <section className="rounded-2xl bg-[var(--vaka-primary-pale)] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="delivery-criteria" className={labelClassName}>
            <span className="ml-2 text-[var(--vaka-primary)]">●</span>
            معیارهای تحویل کار
            <span className="mr-1 text-[var(--vaka-danger)]">*</span>
          </label>
        </div>

        <textarea
          id="delivery-criteria"
          value={data.deliveryCriteria}
          onChange={(event) => onChange("deliveryCriteria", event.target.value)}
          rows={3}
          required
          placeholder="مثلاً تحویل کالا به آدرس مشخص‌شده و ارائه رسید خرید"
          className={`${inputClassName} resize-none leading-7`}
        />

        <p className="mt-3 text-xs leading-6 text-[var(--vaka-text-muted)]">
          مشخص کنید پس از انجام چه مواردی، کار کامل و قابل تأیید محسوب می‌شود.
        </p>
      </section>
    </div>
  );
}
