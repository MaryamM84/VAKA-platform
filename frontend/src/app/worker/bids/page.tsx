
"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import {
  getMyBids,
  getDiscoverableTask,
  type WorkerBidApi,
  type DiscoverableTaskApi,
} from "@/lib/worker-api";
import styles from "./MyBids.module.css";

type BidStatus = "pending" | "accepted" | "rejected";
type FilterStatus = "all" | BidStatus;
type SortOrder = "newest" | "oldest";

const statusLabels: Record<WorkerBidApi["status"], string> = {
  ACTIVE: "در انتظار بررسی",
  ACCEPTED: "پذیرفته‌شده",
  REJECTED: "ردشده",
  WITHDRAWN: "پس‌گرفته‌شده",
  EXPIRED: "منقضی‌شده",
};

function getFilterStatus(status: WorkerBidApi["status"]): BidStatus {
  if (status === "ACTIVE") return "pending";
  if (status === "ACCEPTED") return "accepted";
  return "rejected";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";

  const days = Math.ceil(minutes / 1440);

  if (days >= 1) return `${formatNumber(days)} روز`;

  return `${formatNumber(minutes)} دقیقه`;
}

function formatEmployerWage(task: DiscoverableTaskApi | undefined) {
  if (!task || !Number.isFinite(task.wage_budget_amount)) {
    return "در دسترس نیست";
  }

  const currencyLabels: Record<string, string> = {
    IRR: "ریال",
    IRT: "تومان",
    TOMAN: "تومان",
  };

  const currency =
    currencyLabels[task.currency_code?.toUpperCase()] ??
    task.currency_code ??
    "";

  return `${formatNumber(task.wage_budget_amount)} ${currency}`.trim();
}

export default function MyBidsPage() {
  const [bids, setBids] = useState<WorkerBidApi[]>([]);
  const [taskDetails, setTaskDetails] = useState<
    Record<string, DiscoverableTaskApi>
  >({});
  const [activeTab, setActiveTab] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [actionNotices, setActionNotices] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function loadBids() {
      try {
        setLoading(true);
        setError(null);

        const result = await getMyBids();

        if (cancelled) return;

        setBids(result);

        const uniqueTaskIds = [...new Set(result.map((bid) => bid.task_id))];

        const taskResults = await Promise.allSettled(
          uniqueTaskIds.map(async (taskId) => {
            const task = await getDiscoverableTask(taskId);
            return { taskId, task };
          })
        );

        if (cancelled) return;

        const details: Record<string, DiscoverableTaskApi> = {};

        taskResults.forEach((result) => {
          if (result.status === "fulfilled") {
            details[result.value.taskId] = result.value.task;
          }
        });

        setTaskDetails(details);
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "دریافت پیشنهادهای شما با خطا مواجه شد."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBids();

    return () => {
      cancelled = true;
    };
  }, []);

  const bidStatistics = useMemo(() => {
    const pending = bids.filter((bid) => bid.status === "ACTIVE").length;
    const accepted = bids.filter((bid) => bid.status === "ACCEPTED").length;
    const rejected = bids.length - pending - accepted;

    return {
      total: bids.length,
      pending,
      accepted,
      rejected,
    };
  }, [bids]);

  const visibleBids = useMemo(() => {
    let result = [...bids];

    if (activeTab !== "all") {
      result = result.filter(
        (bid) => getFilterStatus(bid.status) === activeTab
      );
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();

      result = result.filter((bid) => {
        const task = taskDetails[bid.task_id];

        return (
          bid.task_id.toLowerCase().includes(query) ||
          bid.message.toLowerCase().includes(query) ||
          (task?.title ?? "").toLowerCase().includes(query)
        );
      });
    }

    result.sort((a, b) => {
      const difference =
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime();

      return sortOrder === "newest" ? difference : -difference;
    });

    return result;
  }, [bids, activeTab, search, sortOrder, taskDetails]);

  const tabs: { label: string; value: FilterStatus }[] = [
    { label: "همه پیشنهادها", value: "all" },
    { label: "در انتظار بررسی", value: "pending" },
    { label: "پذیرفته‌شده", value: "accepted" },
    { label: "ردشده و سایر", value: "rejected" },
  ];

  function handleWithdrawClick(bidId: string) {
    setActionNotices((previous) => ({
      ...previous,
      [bidId]:
        "پیشنهاد پس گرفته شد",
    }));
  }

  const selectedTask = selectedTaskId
    ? taskDetails[selectedTaskId]
    : undefined;

  return (
    <DashboardLayout
      title="پیشنهادهای ارسالی من"
      description="پیشنهادهایی که برای کارهای مختلف ارسال کرده‌اید را مشاهده کنید."
    >
      <section className={styles.bidPage}>
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
              <span>ردشده و سایر</span>
            </div>
            <span className={`${styles.statIcon} ${styles.rejectedIcon}`}>
              ×
            </span>
          </div>
        </div>

        <section className={styles.bidPanel}>
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

          <div className={styles.toolbar}>
            <label className={styles.searchBox}>
              <input
                type="search"
                placeholder="جست‌وجو بر اساس عنوان کار یا متن پیشنهاد..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <span aria-hidden="true">⌕</span>
            </label>
          </div>

          <div className={styles.bidList}>
            {loading ? (
              <div className={styles.emptyState}>
                <strong>در حال دریافت پیشنهادها...</strong>
              </div>
            ) : error ? (
              <div className={styles.emptyState}>
                <strong>دریافت پیشنهادها ناموفق بود</strong>
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  تلاش مجدد
                </button>
              </div>
            ) : visibleBids.length > 0 ? (
              visibleBids.map((bid) => {
                const filterStatus = getFilterStatus(bid.status);
                const task = taskDetails[bid.task_id];

                return (
                  <article className={styles.bidCard} key={bid.bid_id}>
                    <div className={styles.bidHeader}>
                      <div className={styles.bidTitleGroup}>
                        <h2>
                          پیشنهاد برای کار:{" "}
                          {task?.title ?? "عنوان کار در دسترس نیست"}
                        </h2>
                      </div>

                      <span
                        className={`${styles.statusBadge} ${
                          styles[`status_${filterStatus}`]
                        }`}
                      >
                        {statusLabels[bid.status]}
                      </span>
                    </div>

                    {bid.message && (
                      <p className={styles.bidDescription}>
                        {bid.message}
                      </p>
                    )}

                    <div className={styles.bidMeta}>
                      <div>
                        <span>مبلغ پیشنهادی کارفرما:</span>
                        <strong>{formatEmployerWage(task)}</strong>
                      </div>

                      <div>
                        <span>مدت زمان انجام:</span>
                        <strong>
                          {formatDuration(bid.proposed_duration_minutes)}
                        </strong>
                      </div>

                      <div>
                        <span>تاریخ ارسال:</span>
                        <strong>{formatDate(bid.created_at)}</strong>
                      </div>
                    </div>

                    <div className={styles.bidActions}>
                      <button
                        type="button"
                        className={styles.detailsButton}
                        onClick={() => setSelectedTaskId(bid.task_id)}
                      >
                        مشاهده جزئیات
                      </button>

                      {bid.status === "ACTIVE" && (
                        <button
                          type="button"
                          className={styles.withdrawButton}
                          onClick={() => handleWithdrawClick(bid.bid_id)}
                        >
                          پس گرفتن پیشنهاد
                        </button>
                      )}
                    </div>

                    {actionNotices[bid.bid_id] && (
                      <p className={styles.actionNotice} role="status">
                        {actionNotices[bid.bid_id]}
                      </p>
                    )}
                  </article>
                );
              })
            ) : (
              <div className={styles.emptyState}>
                <span aria-hidden="true">⌕</span>
                <strong>
                  {bids.length === 0
                    ? "هنوز پیشنهادی ارسال نکرده‌اید."
                    : "پیشنهادی پیدا نشد"}
                </strong>
                <p>
                  {bids.length === 0
                    ? "پس از ارسال پیشنهاد برای یک کار، اطلاعات آن در این قسمت نمایش داده می‌شود."
                    : "عبارت جست‌وجو یا فیلتر انتخاب‌شده را تغییر دهید."}
                </p>

                {bids.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setActiveTab("all");
                    }}
                  >
                    پاک کردن فیلترها
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={styles.panelFooter}>
            <span>
              نمایش {formatNumber(visibleBids.length)} پیشنهاد
            </span>

            <label>
              مرتب‌سازی:
              <select
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(event.target.value as SortOrder)
                }
              >
                <option value="newest">جدیدترین</option>
                <option value="oldest">قدیمی‌ترین</option>
              </select>
            </label>
          </div>
        </section>
      </section>

      {selectedTaskId && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedTaskId(null)}
          role="presentation"
        >
          <section
            className={styles.detailsModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 id="task-details-title">جزئیات کار</h2>
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                aria-label="بستن"
              >
                ×
              </button>
            </div>

            {selectedTask ? (
              <>
                <h3>{selectedTask.title}</h3>

                <p className={styles.modalDescription}>
                  {selectedTask.description || "توضیحی برای این کار ثبت نشده است."}
                </p>

                <div className={styles.modalMeta}>
                  <div>
                    <span>دسته‌بندی:</span>
                    <strong>{selectedTask.category_name || "—"}</strong>
                  </div>

                  <div>
                    <span>مبلغ پیشنهادی کارفرما:</span>
                    <strong>{formatEmployerWage(selectedTask)}</strong>
                  </div>

                  <div>
                    <span>زمان تخمینی انجام:</span>
                    <strong>
                      {formatDuration(selectedTask.estimated_duration_minutes)}
                    </strong>
                  </div>

                  <div>
                    <span>مهلت ارسال پیشنهاد:</span>
                    <strong>
                      {selectedTask.proposal_deadline_at
                        ? formatDate(selectedTask.proposal_deadline_at)
                        : "—"}
                    </strong>
                  </div>
                </div>

                {selectedTask.delivery_criteria && (
                  <div className={styles.deliveryCriteria}>
                    <strong>معیارهای تحویل:</strong>
                    <p>{selectedTask.delivery_criteria}</p>
                  </div>
                )}
              </>
            ) : (
              <p className={styles.modalUnavailable}>
                جزئیات این کار از طریق API در دسترس نیست.
              </p>
            )}

            <button
              type="button"
              className={styles.modalCloseButton}
              onClick={() => setSelectedTaskId(null)}
            >
              بستن
            </button>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
