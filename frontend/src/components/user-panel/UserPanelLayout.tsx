import Image from "next/image";
import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./UserPanelLayout.module.css";

type NavigationId = "profile" | "skills" | "tasks" | "offers" | "security";
type PanelIconName =
  | "user"
  | "tools"
  | "clipboard"
  | "mail"
  | "shield"
  | "chevron-left"
  | "check-circle"
  | "verified-seal";

type UserPanelLayoutProps = {
  children: ReactNode;
  profileName: string;
  completion: number;
  rating?: number;
  completedTaskCount?: number;
  receivedOffersCount?: number;
  activePage?: NavigationId;
  isVerified?: boolean;
};

const navigation: Array<{
  id: NavigationId;
  label: string;
  icon: Exclude<PanelIconName, "chevron-left" | "check-circle" | "verified-seal">;
  meta: "chevron" | "dot" | "offers" | "verified";
}> = [
  { id: "profile", label: "پروفایل من", icon: "user", meta: "chevron" },
  { id: "skills", label: "مهارت‌ها و شرایط فعالیت", icon: "tools", meta: "dot" },
  { id: "tasks", label: "تسک‌های من", icon: "clipboard", meta: "chevron" },
  { id: "offers", label: "پیشنهادهای دریافتی", icon: "mail", meta: "offers" },
  { id: "security", label: "احراز هویت و امنیت", icon: "shield", meta: "verified" },
];

function toPersianDigits(value: string | number) {
  return String(value)
    .replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])
    .replace(/[٠-٩]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"["٠١٢٣٤٥٦٧٨٩".indexOf(digit)]);
}

function PanelIcon({ name }: { name: PanelIconName }) {
  const paths: Record<PanelIconName, ReactNode> = {
    user: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="9" r="3" />
        <path d="M6.8 18.2c.8-2.6 2.5-3.9 5.2-3.9s4.4 1.3 5.2 3.9" />
      </>
    ),
    tools: (
      <>
        <path d="M14.2 6.2a4.2 4.2 0 0 0 5.5 5.5l-8.8 8.8a2 2 0 0 1-2.8-2.8l8.8-8.8a4.2 4.2 0 0 0-5.5-5.5l2.5 2.5-2.9 2.9-2.5-2.6a4.2 4.2 0 0 0 5.7 0Z" />
        <path d="m4 4 5.2 5.2M3.2 8.2l5-5M15.5 15.5l5.3 5.3" />
      </>
    ),
    clipboard: (
      <>
        <rect x="5" y="4.5" width="14" height="17" rx="1.8" />
        <path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h5" />
      </>
    ),
    mail: (
      <>
        <rect x="3.2" y="5" width="17.6" height="14" rx="1.8" />
        <path d="m4.2 6.5 7.8 6 7.8-6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 2.8 19.2 5.7v5.1c0 4.5-2.7 7.9-7.2 10.4-4.5-2.5-7.2-5.9-7.2-10.4V5.7L12 2.8Z" />
        <path d="m8.7 11.8 2.2 2.2 4.5-4.6" />
      </>
    ),
    "chevron-left": <path d="m14.5 5-7 7 7 7" />,
    "check-circle": (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m7.8 12.2 2.8 2.8 5.8-6" />
      </>
    ),
    "verified-seal": (
      <>
        <path d="m12 2.4 2.2 1.8 2.8-.1 1.1 2.6 2.5 1.3-.5 2.8 1.2 2.5-2 2-.3 2.8-2.7.8-1.6 2.3-2.7-.8-2.7.8-1.6-2.3-2.7-.8-.3-2.8-2-2 1.2-2.5-.5-2.8 2.5-1.3 1.1-2.6 2.8.1L12 2.4Z" />
        <path d="m8.5 12.2 2.2 2.2 4.8-4.9" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default function UserPanelLayout({
  children,
  profileName,
  completion,
  rating = 4.8,
  completedTaskCount = 12,
  receivedOffersCount = 3,
  activePage = "skills",
  isVerified = true,
}: UserPanelLayoutProps) {
  const safeCompletion = Math.min(100, Math.max(0, Math.round(completion)));
  const ratingText = toPersianDigits(rating.toFixed(1));
  const completedTasksText = toPersianDigits(completedTaskCount);
  const offersText = toPersianDigits(receivedOffersCount);
  const displayName = toPersianDigits(profileName.trim() || "مریم احمدی");

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="مسیر صفحه">
          <Link href="/">خانه</Link>
          <span aria-hidden="true">/</span>
          <Link href="/welcome">پیشخوان واکا</Link>
          <span aria-hidden="true">/</span>
          <strong>مهارت‌ها و تنظیمات مجری</strong>
        </nav>

        <div className={styles.columns}>
          <main className={styles.content}>{children}</main>

          <aside className={styles.sidebar} aria-label="پنل کاربری">
            <section className={styles.profileCard}>
              <div className={styles.profileIdentity}>
                <div className={styles.avatar}>
                  <Image
                    src="/images/maryam-ahmadi-avatar.png"
                    alt={`تصویر پروفایل ${displayName}`}
                    width={96}
                    height={96}
                    priority
                    sizes="96px"
                    className={styles.avatarImage}
                  />
                  {isVerified && (
                    <span className={styles.avatarVerified} aria-label="حساب تأییدشده">
                      <PanelIcon name="verified-seal" />
                    </span>
                  )}
                </div>

                <h2 className={styles.profileName}>{displayName}</h2>

                <div className={styles.roleBadges}>
                  <span className={styles.activeRole}>مجری فعال</span>
                  <span className={styles.secondaryRole}>کارفرما و مجری</span>
                </div>
              </div>

              <div className={styles.profileStats} aria-label="آمار عملکرد">
                <div className={styles.statBlock}>
                  <strong className={styles.ratingValue}>
                    {ratingText}<span aria-hidden="true">★</span>
                  </strong>
                  <span className={styles.statLabel}>امتیاز کاربران</span>
                </div>

                <span className={styles.statDivider} aria-hidden="true" />

                <div className={styles.statBlock}>
                  <strong className={styles.taskValue}>
                    {completedTasksText}<span>تسک</span>
                  </strong>
                  <span className={styles.statLabel}>انجام موفق</span>
                </div>
              </div>

              <section className={styles.completion} aria-label="تکمیل پروفایل">
                <div className={styles.completionLabel}>
                  <span>تکمیل پروفایل</span>
                  <strong>{toPersianDigits(safeCompletion)}٪</strong>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-label="درصد تکمیل پروفایل"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={safeCompletion}
                >
                  <span style={{ width: `${safeCompletion}%` }} />
                </div>
                <p>با تکمیل پروفایل، اعتماد بیشتری بسازید.</p>
              </section>

              <nav className={styles.profileNav} aria-label="بخش‌های پنل کاربری">
                {navigation.map((item) => {
                  const active = item.id === activePage;
                  const main = (
                    <span className={styles.navItemMain}>
                      <PanelIcon name={item.icon} />
                      <span>{item.label}</span>
                    </span>
                  );

                  const meta = (
                    <span className={styles.navItemMeta}>
                      {item.meta === "chevron" && <PanelIcon name="chevron-left" />}
                      {item.meta === "dot" && <span className={styles.activeDot} />}
                      {item.meta === "offers" && <span className={styles.offerBadge}>{offersText} جدید</span>}
                      {item.meta === "verified" && isVerified && (
                        <span className={styles.verifiedStatus} aria-label="تأییدشده">
                          <PanelIcon name="check-circle" />
                        </span>
                      )}
                    </span>
                  );

                  if (active) {
                    return (
                      <Link
                        key={item.id}
                        href={item.id === "skills" ? "/user/skills" : `/user/${item.id}`}
                        className={`${styles.navItem} ${styles.navItemActive}`}
                        aria-current="page"
                      >
                        {main}
                        {meta}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.navItem}
                      disabled
                      aria-label={`${item.label}، در انتظار راه‌اندازی`}
                      title="این بخش در مرحله بعدی فعال می‌شود"
                    >
                      {main}
                      {meta}
                    </button>
                  );
                })}
              </nav>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
