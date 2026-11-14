
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import VakaDialog from "@/components/ui/VakaDialog";
import {
  getEmployerBids,
  acceptEmployerBid,
  rejectEmployerBid,
  type EmployerBidListApi,
} from "@/lib/employer-api";
import styles from "./EmployerBids.module.css";

type BidStatus = EmployerBidListApi["status"];

const statusLabels: Record<BidStatus, string> = {
  ACTIVE: "در انتظار بررسی",
  ACCEPTED: "پذیرفته‌شده",
  REJECTED: "ردشده",
  WITHDRAWN: "پس‌گرفته‌شده",
  EXPIRED: "منقضی‌شده",
};

const statusClasses: Record<BidStatus, string> = {
  ACTIVE: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  EXPIRED: "expired",
};

// ترتیب نمایش پیشنهادها در صفحه
const statusOrder: Record<BidStatus, number> = {
  ACTIVE: 1,
  ACCEPTED: 2,
  REJECTED: 3,
  WITHDRAWN: 4,
  EXPIRED: 5,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "—";
  }

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${formatNumber(days)} روز`);
  }

  if (hours > 0) {
    parts.push(`${formatNumber(hours)} ساعت`);
  }

  if (remainingMinutes > 0 && days === 0) {
    parts.push(`${formatNumber(remainingMinutes)} دقیقه`);
  }

  return parts.length > 0 ? parts.join(" و ") : "کمتر از یک دقیقه";
}

export default function EmployerBidsPage() {
  const [bids, setBids] = useState<EmployerBidListApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedBid, setExpandedBid] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<{ bidId: string; action: "accept" | "reject" } | null>(null);

  const loadBids = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getEmployerBids();
      setBids(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "دریافت پیشنهادها ناموفق بود."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBids();
  }, [loadBids]);

  const sortedBids = useMemo(() => {
    return [...bids].sort((a, b) => {
      const statusDifference =
        statusOrder[a.status] - statusOrder[b.status];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });
  }, [bids]);

  async function handleBidAction(bidId: string, action: "accept" | "reject") {
    setActionLoading((previous) => ({ ...previous, [bidId]: true }));
    setActionErrors((previous) => ({ ...previous, [bidId]: "" }));
    try {
      if (action === "accept") await acceptEmployerBid(bidId);
      else await rejectEmployerBid(bidId);
      await loadBids();
    } catch (err) {
      setActionErrors((previous) => ({
        ...previous,
        [bidId]: err instanceof Error ? err.message : "عملیات انجام نشد. دوباره تلاش کنید.",
      }));
    } finally {
      setActionLoading((previous) => ({ ...previous, [bidId]: false }));
    }
  }

  return (
    <DashboardLayout
      title="پیشنهادهای دریافتی"
      description="پیشنهادهایی که مجریان برای کارهای شما ارسال کرده‌اند."
    >
      <section className={styles.bidsPage} dir="rtl">
        {loading ? (
          <div className={styles.emptyState} role="status">
            در حال دریافت پیشنهادها...
          </div>
        ) : error ? (
          <div className={styles.errorState} role="alert">
            <strong>دریافت پیشنهادها ناموفق بود</strong>
            <p>{error}</p>

            <button
              type="button"
              className={styles.retryButton}
              onClick={() => void loadBids()}
            >
              تلاش مجدد
            </button>
          </div>
        ) : sortedBids.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>هنوز پیشنهادی دریافت نکرده‌اید.</strong>

            <p>
              پس از ارسال پیشنهاد توسط مجریان، فهرست آن‌ها در این بخش
              نمایش داده می‌شود.
            </p>

            <Link href="/employer/tasks">
              مشاهده کارهای من
            </Link>
          </div>
        ) : (
          <>
            <div className={styles.listHeader}>
              <div>
                <h2>همه پیشنهادهای دریافتی</h2>
                <p>
                  {formatNumber(sortedBids.length)} پیشنهاد برای کارهای شما
                </p>
              </div>
            </div>

            <div className={styles.bidList}>
              {sortedBids.map((bid) => {
                const isExpanded = expandedBid === bid.bid_id;

                return (
                  <article
                    key={bid.bid_id}
                    className={styles.bidCard}
                  >
                    <div className={styles.bidHeader}>
                      <div className={styles.executorInfo}>
                        <div className={styles.executorAvatar}>
                          {(bid.executor_name || "م").charAt(0)}
                        </div>

                        <div className={styles.executorDetails}>
                          <h3>
                            {bid.executor_name || "مجری"}
                          </h3>

                          <Link
                            href={`/employer/tasks/${bid.task_id}/proposals`}
                            className={styles.taskLink}
                          >
                            {bid.task_title || "کار بدون عنوان"}
                          </Link>
                        </div>
                      </div>

                      <span
                        className={`${styles.statusBadge} ${
                          styles[statusClasses[bid.status]]
                        }`}
                      >
                        {statusLabels[bid.status] ?? bid.status}
                      </span>
                    </div>

                    {bid.message && (
                      <div className={styles.bidDescription}>
                        <p>
                          {isExpanded
                            ? bid.message
                            : bid.message.length > 145
                              ? `${bid.message.slice(0, 145)}...`
                              : bid.message}
                        </p>

                        {bid.message.length > 145 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBid(
                                isExpanded ? null : bid.bid_id
                              )
                            }
                          >
                            {isExpanded
                              ? "نمایش کمتر"
                              : "مشاهده متن کامل"}
                          </button>
                        )}
                      </div>
                    )}

                    <div className={styles.bidMeta}>
                      <div>
                        <span>زمان پیشنهادی انجام:</span>
                        <strong>
                          {formatDuration(
                            bid.proposed_duration_minutes
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>تاریخ ارسال:</span>
                        <strong>
                          {formatDate(bid.created_at)}
                        </strong>
                      </div>
                    </div>

                    <div className={styles.bidActions}>
                      <Link
                        href={`/worker/${bid.executor_profile_id}`}
                        className={styles.profileButton}
                      >
                        مشاهده پروفایل مجری
                      </Link>

                      {bid.status === "ACTIVE" && (
                        <div className={styles.actionButtons}>
                          <button
                            type="button"
                            className={styles.rejectButton}
                            disabled={!!actionLoading[bid.bid_id]}
                            onClick={() => setPendingAction({ bidId: bid.bid_id, action: "reject" })}
                          >
                            {actionLoading[bid.bid_id] ? "در حال انجام..." : "رد پیشنهاد"}
                          </button>

                          <button
                            type="button"
                            className={styles.acceptButton}
                            disabled={!!actionLoading[bid.bid_id]}
                            onClick={() => setPendingAction({ bidId: bid.bid_id, action: "accept" })}
                          >
                            {actionLoading[bid.bid_id] ? "در حال انجام..." : "پذیرش پیشنهاد"}
                          </button>
                        </div>
                      )}
                    </div>

                    {actionErrors[bid.bid_id] && (
                      <p className={styles.actionNotice} role="alert">
                        {actionErrors[bid.bid_id]}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
      <VakaDialog
        open={!!pendingAction}
        title={pendingAction?.action === "accept" ? "پذیرش پیشنهاد مجری" : "رد پیشنهاد مجری"}
        description={pendingAction?.action === "accept" ? "آیا از پذیرش این پیشنهاد مطمئن هستید؟" : "آیا از رد این پیشنهاد مطمئن هستید؟"}
        confirmLabel={pendingAction?.action === "accept" ? "بله، پذیرش پیشنهاد" : "بله، رد پیشنهاد"}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (!pendingAction) return;
          const current = pendingAction;
          setPendingAction(null);
          void handleBidAction(current.bidId, current.action);
        }}
      />
    </DashboardLayout>
  );
}
