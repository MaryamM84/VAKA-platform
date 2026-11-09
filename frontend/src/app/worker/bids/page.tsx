"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import styles from "./MyBids.module.css";

type BidStatus = "pending" | "accepted" | "rejected";

type Bid = {
  id: number;
  taskTitle: string;
  employerName: string;
  description: string;
  amount: number;
  duration: number;
  date: string;
  status: BidStatus;
};

const initialBids: Bid[] = [
  {
    id: 1,
    taskTitle: "طراحی رابط کاربری اپلیکیشن فروشگاهی",
    employerName: "علی رضایی",
    description:
      "طراحی صفحات اصلی اپلیکیشن فروشگاهی با تمرکز بر تجربه کاربری و طراحی مدرن",
    amount: 15000000,
    duration: 12,
    date: "۱۴۰۵/۰۳/۲۸",
    status: "pending",
  },
  {
    id: 2,
    taskTitle: "توسعه وب‌سایت شرکتی با React",
    employerName: "محمد احمدی",
    description:
      "پیاده‌سازی صفحات وب‌سایت شرکتی با طراحی واکنش‌گرا و ساختار مناسب",
    amount: 8500000,
    duration: 10,
    date: "۱۴۰۵/۰۳/۲۵",
    status: "accepted",
  },
  {
    id: 3,
    taskTitle: "طراحی بنر تبلیغاتی شبکه‌های اجتماعی",
    employerName: "نگار کریمی",
    description:
      "طراحی مجموعه‌ای از بنرهای تبلیغاتی برای کمپین جدید برند",
    amount: 2500000,
    duration: 4,
    date: "۱۴۰۵/۰۳/۲۰",
    status: "rejected",
  },
  {
    id: 4,
    taskTitle: "طراحی داشبورد مدیریتی",
    employerName: "سارا محمدی",
    description:
      "طراحی رابط کاربری داشبورد مدیریتی با نمودارها و بخش‌های آماری",
    amount: 11000000,
    duration: 14,
    date: "۱۴۰۵/۰۳/۱۵",
    status: "pending",
  },
  {
    id: 5,
    taskTitle: "طراحی صفحه فرود محصول",
    employerName: "رضا موسوی",
    description:
      "طراحی یک صفحه فرود جذاب و واکنش‌گرا برای معرفی محصول جدید",
    amount: 4000000,
    duration: 5,
    date: "۱۴۰۵/۰۳/۱۰",
    status: "accepted",
  },
];

const statusLabels: Record<BidStatus, string> = {
  pending: "در انتظار بررسی",
  accepted: "پذیرفته‌شده",
  rejected: "ردشده",
};

const tabs: { label: string; value: "all" | BidStatus }[] = [
  { label: "همه پیشنهادها", value: "all" },
  { label: "در انتظار بررسی", value: "pending" },
  { label: "پذیرفته‌شده", value: "accepted" },
  { label: "ردشده", value: "rejected" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatPrice(price: number) {
  return `${formatNumber(price)} تومان`;
}

export default function MyBidsPage() {
  const [activeTab, setActiveTab] = useState<"all" | BidStatus>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");

  // محاسبه آمار پیشنهادها
  const bidStatistics = useMemo(
    () => ({
      total: initialBids.length,
      pending: initialBids.filter((bid) => bid.status === "pending").length,
      accepted: initialBids.filter((bid) => bid.status === "accepted").length,
      rejected: initialBids.filter((bid) => bid.status === "rejected").length,
    }),
    []
  );

  // فیلتر، جست‌وجو و مرتب‌سازی پیشنهادها
  const visibleBids = useMemo(() => {
    let result = [...initialBids];

    if (activeTab !== "all") {
      result = result.filter((bid) => bid.status === activeTab);
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();

      result = result.filter(
        (bid) =>
          bid.taskTitle.toLowerCase().includes(query) ||
          bid.employerName.toLowerCase().includes(query)
      );
    }

    if (sortOrder === "newest") {
      result.sort((a, b) => b.id - a.id);
    } else if (sortOrder === "oldest") {
      result.sort((a, b) => a.id - b.id);
    } else if (sortOrder === "highest") {
      result.sort((a, b) => b.amount - a.amount);
    } else if (sortOrder === "lowest") {
      result.sort((a, b) => a.amount - b.amount);
    }

    return result;
  }, [activeTab, search, sortOrder]);

  return (
    <DashboardLayout
      title="پیشنهادهای ارسالی من"
      description="پیشنهادهایی که برای کارهای مختلف ارسال کرده‌اید را مشاهده کنید."
    >
      <section className={styles.bidPage}>
        {/* آمار پیشنهادها */}
        <div className={styles.statistics}>
          <div className={styles.statCard}>
            <div>
              <strong>{formatNumber(bidStatistics.total)}</strong>
              <span>همه پیشنهادها</span>
            </div>

            <span className={`${styles.statIcon} ${styles.totalIcon}`}>
              ▤
            </span>
          </div>

          <div className={styles.statCard}>
            <div>
              <strong>{formatNumber(bidStatistics.pending)}</strong>
              <span>در انتظار بررسی</span>
            </div>

            <span className={`${styles.statIcon} ${styles.pendingIcon}`}>
              ◷
            </span>
          </div>

          <div className={styles.statCard}>
            <div>
              <strong>{formatNumber(bidStatistics.accepted)}</strong>
              <span>پذیرفته‌شده</span>
            </div>

            <span className={`${styles.statIcon} ${styles.acceptedIcon}`}>
              ✓
            </span>
          </div>

          <div className={styles.statCard}>
            <div>
              <strong>{formatNumber(bidStatistics.rejected)}</strong>
              <span>ردشده</span>
            </div>

            <span className={`${styles.statIcon} ${styles.rejectedIcon}`}>
              ×
            </span>
          </div>
        </div>

        <section className={styles.bidPanel}>
          {/* فیلتر وضعیت */}
          <nav className={styles.tabs} aria-label="فیلتر وضعیت پیشنهادها">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={`${styles.tab} ${
                  activeTab === tab.value ? styles.activeTab : ""
                }`}
                onClick={() => setActiveTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* جست‌وجو */}
          <div className={styles.toolbar}>
            <label className={styles.searchBox}>
              <input
                type="search"
                placeholder="جست‌وجو بر اساس عنوان کار یا نام کارفرما..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <span aria-hidden="true">⌕</span>
            </label>
          </div>

          {/* فهرست پیشنهادها */}
          <div className={styles.bidList}>
            {visibleBids.length > 0 ? (
              visibleBids.map((bid) => (
                <article className={styles.bidCard} key={bid.id}>
                  <div className={styles.bidHeader}>
                    <div className={styles.bidTitleGroup}>
                      <h2>{bid.taskTitle}</h2>

                      <p>
                        کارفرما: <strong>{bid.employerName}</strong>
                      </p>
                    </div>

                    <span
                      className={`${styles.statusBadge} ${
                        styles[`status_${bid.status}`]
                      }`}
                    >
                      {statusLabels[bid.status]}
                    </span>
                  </div>

                  <p className={styles.bidDescription}>
                    {bid.description}
                  </p>

                  <div className={styles.bidMeta}>
                    <div>
                      <span>مبلغ پیشنهادی:</span>
                      <strong>{formatPrice(bid.amount)}</strong>
                    </div>

                    <div>
                      <span>مدت زمان انجام:</span>
                      <strong>{formatNumber(bid.duration)} روز</strong>
                    </div>

                    <div>
                      <span>تاریخ ارسال:</span>
                      <strong>{bid.date}</strong>
                    </div>
                  </div>

                  <div className={styles.bidActions}>
                    <Link
                      href={`/worker/bids/${bid.id}`}
                      className={styles.detailsButton}
                    >
                      مشاهده جزئیات پیشنهاد
                      <span>←</span>
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className={styles.emptyState}>
                <span aria-hidden="true">⌕</span>

                <strong>پیشنهادی پیدا نشد</strong>

                <p>
                  عبارت جست‌وجو یا فیلتر انتخاب‌شده را تغییر دهید.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setActiveTab("all");
                  }}
                >
                  پاک کردن فیلترها
                </button>
              </div>
            )}
          </div>

          {/* مرتب‌سازی و تعداد پیشنهادها */}
          <div className={styles.panelFooter}>
            <span>
              نمایش {formatNumber(visibleBids.length)} پیشنهاد
            </span>

            <label>
              مرتب‌سازی:
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              >
                <option value="newest">جدیدترین</option>
                <option value="oldest">قدیمی‌ترین</option>
                <option value="highest">بیشترین مبلغ</option>
                <option value="lowest">کمترین مبلغ</option>
              </select>
            </label>
          </div>
        </section>
      </section>
    </DashboardLayout>
  );
}