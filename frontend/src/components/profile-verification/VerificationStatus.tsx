import type { VerificationStatus as Status } from "./types";

const statusContent: Record<Status, { title: string; description: string; badge: string; color: string }> = {
  not_submitted: { title: "احراز هویت تکمیل نشده", description: "برای فعال شدن امکانات مجری، اطلاعات هویتی و مدارک خود را تکمیل کنید.", badge: "تکمیل نشده", color: "var(--vaka-text-muted)" },
  pending: { title: "در انتظار بررسی", description: "درخواست شما ثبت شده و پس از بررسی کارشناسان، نتیجه در همین بخش نمایش داده می‌شود.", badge: "در حال بررسی", color: "var(--vaka-warning)" },
  approved: { title: "احراز هویت تأیید شده", description: "هویت شما تأیید شده است و می‌توانید از امکانات مخصوص مجریان استفاده کنید.", badge: "تأیید شده", color: "var(--vaka-success)" },
  rejected: { title: "نیازمند اصلاح اطلاعات", description: "درخواست نیاز به اصلاح دارد. دلیل اعلام‌شده را بررسی و مدارک یا اطلاعات لازم را اصلاح کنید.", badge: "نیازمند اصلاح", color: "var(--vaka-danger)" },
};

export default function VerificationStatus({ status, rejectionReason }: { status: Status; rejectionReason?: string | null }) {
  const content = statusContent[status];
  return (
    <section aria-live="polite" className="rounded-2xl border border-[var(--vaka-border)] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-[var(--vaka-text)]">وضعیت احراز هویت</h3>
        <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ color: content.color, backgroundColor: `color-mix(in srgb, ${content.color} 12%, white)` }}>{content.badge}</span>
      </div>
      <p className="mt-3 text-base font-semibold text-[var(--vaka-text)]">{content.title}</p>
      <p className="mt-1 text-sm leading-7 text-[var(--vaka-text-secondary)]">{content.description}</p>
      {status === "rejected" && rejectionReason && <div className="mt-4 rounded-xl border border-[var(--vaka-danger)]/20 bg-[var(--vaka-danger)]/5 p-4"><p className="text-xs font-semibold text-[var(--vaka-danger)]">دلیل اعلام‌شده</p><p className="mt-1 text-sm leading-6 text-[var(--vaka-text)]">{rejectionReason}</p></div>}
    </section>
  );
}
