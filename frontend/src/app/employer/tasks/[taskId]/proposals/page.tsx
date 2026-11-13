
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import {
  EmployerBidListApi,
  EmployerTaskApi,
  getEmployerTasks,
  getTaskBids,
} from "@/lib/employer-api";
import styles from "./Proposals.module.css";

type SortOrder = "newest" | "duration";

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

function getBidStatusLabel(status: EmployerBidListApi["status"]) {
  switch (status) {
    case "ACCEPTED":
      return "پذیرفته‌شده";
    case "REJECTED":
      return "ردشده";
    case "WITHDRAWN":
      return "پس‌گرفته‌شده";
    case "EXPIRED":
      return "منقضی‌شده";
    default:
      return "در انتظار بررسی کارفرما";
  }
}

function getTaskStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "پیش‌نویس",
    OPEN: "در انتظار پذیرش کارفرما",
    FUNDING_PENDING: "در انتظار تأمین اعتبار",
    ASSIGNED: "مجری انتخاب شده",
    IN_PROGRESS: "در حال انجام",
    SUBMITTED: "ارسال‌شده برای بررسی",
    APPROVED: "تأییدشده",
    DISPUTED: "دارای اختلاف",
    CANCELLATION_REVIEW: "در حال بررسی لغو",
    COMPLETED: "تکمیل‌شده",
    CANCELLED: "لغوشده",
    EXPIRED: "منقضی‌شده",
  };

  return labels[status] ?? status;
}

function ReceivedProposalsContent() {
  const params = useParams<{ taskId: string }>();
  const taskId = params.taskId;

  const [task, setTask] = useState<EmployerTaskApi | null>(null);
  const [proposals, setProposals] = useState<EmployerBidListApi[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const [actionNotices, setActionNotices] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [tasks, bids] = await Promise.all([
          getEmployerTasks(),
          getTaskBids(taskId),
        ]);

        if (cancelled) return;

        const currentTask = tasks.find((item) => item.task_id === taskId);

        if (!currentTask) {
          setTask(null);
          setProposals([]);
          setError("کار موردنظر در فهرست کارهای شما پیدا نشد.");
          return;
        }

        setTask(currentTask);
        setProposals(bids);
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "دریافت پیشنهادها با خطا مواجه شد."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const visibleProposals = useMemo(() => {
    const result = [...proposals];

    if (sortOrder === "duration") {
      result.sort(
        (a, b) => a.proposed_duration_minutes - b.proposed_duration_minutes
      );
    } else {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
    }

    return result;
  }, [proposals, sortOrder]);

  const activeCount = proposals.filter(
    (proposal) => proposal.status === "ACTIVE"
  ).length;

  function showActionNotice(bidId: string, action: "accept" | "reject") {
    const message =
      action === "accept"
        ? "عملیات پذیرش پیشنهاد هنوز به API متصل نشده است."
        : "عملیات رد پیشنهاد هنوز به API متصل نشده است.";

    setActionNotices((previous) => ({
      ...previous,
      [bidId]: message,
    }));
  }

  if (loading) {
    return (
      <DashboardLayout
        title="پیشنهادهای دریافتی"
        description="مشاهده و بررسی پیشنهادهای مجریان"
      >
        <div className={styles.emptyState}>در حال دریافت پیشنهادها...</div>
      </DashboardLayout>
    );
  }

  if (error || !task) {
    return (
      <DashboardLayout
        title="پیشنهادهای دریافتی"
        description="مشاهده و بررسی پیشنهادهای مجریان"
      >
        <div className={styles.emptyState}>
          <strong>{error ?? "کار موردنظر پیدا نشد."}</strong>
          <Link href="/employer/tasks">بازگشت به کارهای من</Link>
        </div>
      </DashboardLayout>
    );
  }

  const canReviewProposals = task.status === "OPEN";

  return (
    <DashboardLayout
      title="پیشنهادهای دریافتی"
      description="پیشنهادهای ارسال‌شده برای کار ثبت‌شده خود را بررسی کنید."
    >
      <section className={styles.proposalsPage}>
        <div className={styles.breadcrumb}>
          <Link href="/employer/tasks">کارهای من</Link>
          <span>›</span>
          <span>پیشنهادهای دریافتی</span>
        </div>

        <section className={styles.taskSummary}>
          <div className={styles.taskSummaryContent}>
            <span className={styles.taskStatus}>
              {getTaskStatusLabel(task.status)}
            </span>

            <h2>{task.title}</h2>

            <span className={styles.taskCategory}>
              {task.category_name}
            </span>
          </div>

          <div className={styles.taskProposalCount}>
            <strong>{formatNumber(proposals.length)}</strong>
            <span>پیشنهاد دریافتی</span>
          </div>
        </section>

        {!canReviewProposals && (
          <div className={styles.notice}>
            <strong>این کار در وضعیت دریافت پیشنهاد نیست.</strong>
            <p>
              وضعیت فعلی کار «{getTaskStatusLabel(task.status)}» است. در این
              صفحه می‌توانید پیشنهادهای ثبت‌شده را مشاهده کنید.
            </p>
          </div>
        )}

        <div className={styles.sectionToolbar}>
          <div className={styles.sectionTitle}>
            <h2>پیشنهادهای مجریان</h2>

            <span>
              {formatNumber(activeCount)} پیشنهاد فعال
            </span>
          </div>

          <label className={styles.sortControl}>
            مرتب‌سازی بر اساس:

            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as SortOrder)
              }
            >
              <option value="newest">جدیدترین</option>
              <option value="duration">کمترین زمان انجام</option>
            </select>
          </label>
        </div>

        {visibleProposals.length > 0 ? (
          <div className={styles.proposalList}>
            {visibleProposals.map((proposal) => {
              const durationDays = Math.ceil(
                proposal.proposed_duration_minutes / 1440
              );

              return (
                <article
                  className={styles.proposalCard}
                  key={proposal.bid_id}
                >
                  <div className={styles.proposalHeader}>
                    <div className={styles.workerInfo}>
                      <div className={styles.workerAvatar}>
                        {(proposal.executor_name || "م").charAt(0)}
                      </div>

                      <div>
                        <h3>{proposal.executor_name || "مجری"}</h3>
                      </div>
                    </div>

                    <span
                      className={`${styles.statusBadge} ${
                        styles[
                          proposal.status === "ACTIVE"
                            ? "pending"
                            : proposal.status === "ACCEPTED"
                              ? "accepted"
                              : "rejected"
                        ]
                      }`}
                    >
                      {getBidStatusLabel(proposal.status)}
                    </span>
                  </div>

                  {proposal.message && (
                    <div className={styles.proposalDescription}>
                      <p>
                        {expandedProposal === proposal.bid_id
                          ? proposal.message
                          : proposal.message.length > 145
                            ? `${proposal.message.slice(0, 145)}...`
                            : proposal.message}
                      </p>

                      {proposal.message.length > 145 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProposal(
                              expandedProposal === proposal.bid_id
                                ? null
                                : proposal.bid_id
                            )
                          }
                        >
                          {expandedProposal === proposal.bid_id
                            ? "نمایش کمتر"
                            : "مشاهده متن کامل"}
                        </button>
                      )}
                    </div>
                  )}

                  <div className={styles.proposalMeta}>
                    <div>
                      <span>زمان پیشنهادی انجام:</span>
                      <strong>
                        {formatNumber(durationDays)} روز
                      </strong>
                    </div>

                    <div>
                      <span>تاریخ ارسال:</span>
                      <strong>{formatDate(proposal.created_at)}</strong>
                    </div>
                  </div>

                  <div className={styles.proposalActions}>
                    <Link
                      href={`/worker/${proposal.executor_profile_id}`}
                      className={styles.profileButton}
                    >
                      مشاهده پروفایل مجری
                    </Link>

                    {proposal.status === "ACTIVE" && (
                      <div className={styles.actionButtons}>
                        <button
                          type="button"
                          className={styles.rejectButton}
                          onClick={() =>
                            showActionNotice(proposal.bid_id, "reject")
                          }
                        >
                          رد پیشنهاد
                        </button>

                        <button
                          type="button"
                          className={styles.acceptButton}
                          onClick={() =>
                            showActionNotice(proposal.bid_id, "accept")
                          }
                        >
                          پذیرش پیشنهاد
                        </button>
                      </div>
                    )}
                  </div>

                  {actionNotices[proposal.bid_id] && (
                    <p className={styles.actionNotice} role="status">
                      {actionNotices[proposal.bid_id]}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>هنوز پیشنهادی برای این کار ثبت نشده است.</strong>
            <p>
              پس از ارسال پیشنهاد توسط مجریان، آن‌ها را اینجا می‌بینید.
            </p>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

export default function ReceivedProposalsPage() {
  return (
    <Suspense fallback={null}>
      <ReceivedProposalsContent />
    </Suspense>
  );
}
