
"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import styles from "./Proposals.module.css";

type ProposalStatus = "pending" | "accepted" | "rejected";

type Proposal = {
  id: number;
  workerId: number;
  workerName: string;
  specialty: string;
  rating: number;
  completedTasks: number;
  description: string;
  duration: number;
  sentAt: string;
  status: ProposalStatus;
};

const taskData: Record<
  number,
  {
    title: string;
    category: string;
    status: string;
    statusLabel: string;
  }
> = {
  1: {
    title: "طراحی رابط کاربری اپلیکیشن فروشگاهی",
    category: "طراحی رابط کاربری",
    status: "pending",
    statusLabel: "در انتظار پذیرش مجری",
  },
  2: {
    title: "تدوین ویدیو معرفی محصول",
    category: "تدوین ویدیو",
    status: "inProgress",
    statusLabel: "در حال انجام",
  },
  3: {
    title: "توسعه بخش پرداخت وب‌سایت",
    category: "برنامه‌نویسی",
    status: "completed",
    statusLabel: "تکمیل‌شده",
  },
  4: {
    title: "طراحی بنر کمپین پاییزه",
    category: "طراحی گرافیک",
    status: "pending",
    statusLabel: "در انتظار پذیرش مجری",
  },
  5: {
    title: "تولید محتوای شبکه‌های اجتماعی",
    category: "تولید محتوا",
    status: "rejected",
    statusLabel: "لغوشده",
  },
};

const initialProposals: Proposal[] = [
  {
    id: 1,
    workerId: 1,
    workerName: "سارا محمدی",
    specialty: "طراح رابط کاربری",
    rating: 4.9,
    completedTasks: 78,
    description:
      "سلام، تجربه طراحی چند اپلیکیشن فروشگاهی را دارم و با توجه به توضیحات پروژه، می‌توانم یک رابط کاربری مدرن و ساده طراحی کنم.",
    duration: 12,
    sentAt: "امروز، ۱۰:۳۰",
    status: "pending",
  },
  {
    id: 2,
    workerId: 2,
    workerName: "مریم محمدی",
    specialty: "طراح رابط کاربری",
    rating: 4.8,
    completedTasks: 64,
    description:
      "سلام، در زمینه طراحی رابط کاربری و تجربه کاربری فعالیت می‌کنم. نمونه‌کارهای مرتبط دارم و می‌توانم پروژه را با دقت و کیفیت مناسب انجام دهم.",
    duration: 14,
    sentAt: "امروز، ۰۹:۱۵",
    status: "pending",
  },
  {
    id: 3,
    workerId: 3,
    workerName: "آرش کریمی",
    specialty: "طراح UI/UX",
    rating: 4.7,
    completedTasks: 52,
    description:
      "با بررسی نیازمندی‌های پروژه، پیشنهاد می‌کنم ابتدا ساختار صفحات و مسیرهای اصلی کاربر مشخص شود و سپس طراحی رابط کاربری انجام شود.",
    duration: 15,
    sentAt: "دیروز، ۱۸:۲۰",
    status: "pending",
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function getStatusLabel(status: ProposalStatus) {
  switch (status) {
    case "accepted":
      return "پذیرفته‌شده";
    case "rejected":
      return "ردشده";
    default:
      return "در انتظار بررسی";
  }
}

function ReceivedProposalsContent() {
  const params = useParams<{ taskId: string }>();
  const taskId = Number(params.taskId);

  const task = taskData[taskId];

  const [proposals, setProposals] =
    useState<Proposal[]>(initialProposals);

  const [sortOrder, setSortOrder] = useState("newest");
  const [expandedProposal, setExpandedProposal] =
    useState<number | null>(null);

  const visibleProposals = useMemo(() => {
    const result = [...proposals];

    if (sortOrder === "rating") {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortOrder === "duration") {
      result.sort((a, b) => a.duration - b.duration);
    } else {
      result.sort((a, b) => b.id - a.id);
    }

    return result;
  }, [proposals, sortOrder]);

  const pendingCount = proposals.filter(
    (proposal) => proposal.status === "pending"
  ).length;

  function handleProposalAction(
    id: number,
    status: "accepted" | "rejected"
  ) {
    setProposals((previous) =>
      previous.map((proposal) => {
        if (proposal.id === id) {
          return { ...proposal, status };
        }

        if (status === "accepted" && proposal.status === "pending") {
          return { ...proposal, status: "rejected" };
        }

        return proposal;
      })
    );
  }

  if (!task) {
    return (
      <DashboardLayout
        title="پیشنهادهای دریافتی"
        description="مشاهده و بررسی پیشنهادهای مجریان"
      >
        <div className={styles.emptyState}>
          <strong>کار موردنظر پیدا نشد.</strong>
          <Link href="/employer/tasks">
            بازگشت به کارهای من
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const canReviewProposals = task.status === "pending";

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

        {/* خلاصه کار */}
        <section className={styles.taskSummary}>
          <div className={styles.taskSummaryContent}>
            <span className={styles.taskStatus}>
              {task.statusLabel}
            </span>

            <h2>{task.title}</h2>

            <span className={styles.taskCategory}>
              {task.category}
            </span>
          </div>

          {canReviewProposals && (
            <div className={styles.taskProposalCount}>
              <strong>{formatNumber(proposals.length)}</strong>
              <span>پیشنهاد دریافتی</span>
            </div>
          )}
        </section>

        {!canReviewProposals ? (
          <div className={styles.notice}>
            <strong>امکان بررسی پیشنهاد جدید وجود ندارد.</strong>

            <p>
              وضعیت این کار «{task.statusLabel}» است و در حال حاضر
              امکان انتخاب مجری جدید برای آن وجود ندارد.
            </p>

            <Link href="/employer/tasks">
              بازگشت به کارهای من
            </Link>
          </div>
        ) : (
          <>
            {/* عنوان و مرتب‌سازی */}
            <div className={styles.sectionToolbar}>
              <div className={styles.sectionTitle}>
                <h2>پیشنهادهای مجریان</h2>

                <span>
                  {formatNumber(pendingCount)} پیشنهاد در انتظار بررسی
                </span>
              </div>

              <label className={styles.sortControl}>
                مرتب‌سازی بر اساس:

                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value)}
                >
                  <option value="newest">جدیدترین</option>
                  <option value="rating">بالاترین امتیاز</option>
                  <option value="duration">کمترین زمان انجام</option>
                </select>
              </label>
            </div>

            {visibleProposals.length > 0 ? (
              <div className={styles.proposalList}>
                {visibleProposals.map((proposal) => (
                  <article
                    className={styles.proposalCard}
                    key={proposal.id}
                  >
                    {/* اطلاعات مجری */}
                    <div className={styles.proposalHeader}>
                      <div className={styles.workerInfo}>
                        <div className={styles.workerAvatar}>
                          {proposal.workerName.charAt(0)}
                        </div>

                        <div>
                          <h3>{proposal.workerName}</h3>

                          <span>{proposal.specialty}</span>

                          <div className={styles.workerRating}>
                            <span>★</span>
                            {formatNumber(proposal.rating)}

                            <span className={styles.completedTasks}>
                              ({formatNumber(proposal.completedTasks)} کار تکمیل‌شده)
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`${styles.statusBadge} ${
                          styles[proposal.status]
                        }`}
                      >
                        {getStatusLabel(proposal.status)}
                      </span>
                    </div>

                    {/* متن پیشنهاد */}
                    <div className={styles.proposalDescription}>
                      <p>
                        {expandedProposal === proposal.id
                          ? proposal.description
                          : proposal.description.length > 145
                            ? `${proposal.description.slice(0, 145)}...`
                            : proposal.description}
                      </p>

                      {proposal.description.length > 145 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProposal(
                              expandedProposal === proposal.id
                                ? null
                                : proposal.id
                            )
                          }
                        >
                          {expandedProposal === proposal.id
                            ? "نمایش کمتر"
                            : "مشاهده متن کامل"}
                        </button>
                      )}
                    </div>

                    {/* اطلاعات زمانی */}
                    <div className={styles.proposalMeta}>
                      <div>
                        <span>زمان پیشنهادی انجام:</span>

                        <strong>
                          {formatNumber(proposal.duration)} روز
                        </strong>
                      </div>

                      <div>
                        <span>تاریخ ارسال:</span>

                        <strong>{proposal.sentAt}</strong>
                      </div>
                    </div>

                    {/* عملیات */}
                    <div className={styles.proposalActions}>
                      <Link
                        href={`/worker/${proposal.workerId}`}
                        className={styles.profileButton}
                      >
                        مشاهده پروفایل مجری
                        <span>←</span>
                      </Link>

                      {proposal.status === "pending" && (
                        <div className={styles.actionButtons}>
                          <button
                            type="button"
                            className={styles.rejectButton}
                            onClick={() =>
                              handleProposalAction(
                                proposal.id,
                                "rejected"
                              )
                            }
                          >
                            رد پیشنهاد
                          </button>

                          <button
                            type="button"
                            className={styles.acceptButton}
                            onClick={() =>
                              handleProposalAction(
                                proposal.id,
                                "accepted"
                              )
                            }
                          >
                            انتخاب به‌عنوان مجری
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>
                  هنوز پیشنهادی برای این کار ثبت نشده است.
                </strong>

                <p>
                  پس از ارسال پیشنهاد توسط مجریان، آن‌ها را اینجا می‌بینید.
                </p>
              </div>
            )}
          </>
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