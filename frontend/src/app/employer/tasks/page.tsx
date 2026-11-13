
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import VakaDialog from "@/components/ui/VakaDialog";
import styles from "./MyTasks.module.css";
import {
  getEmployerTasks,
  getEmployerBids,
  cancelEmployerTask,
  updateEmployerTask,
  type EmployerTaskApi,
} from "@/lib/employer-api";

type TaskStatus = "pending" | "inProgress" | "completed" | "rejected";

type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  budget: number;
  date: string;
  createdAt: number;
  proposals: number;
  raw: EmployerTaskApi;
};

function mapTaskStatus(status: string): TaskStatus {
  switch (status) {
    case "DRAFT":
    case "OPEN":
    case "FUNDING_PENDING":
      return "pending";
    case "ASSIGNED":
    case "IN_PROGRESS":
    case "SUBMITTED":
    case "DISPUTED":
    case "CANCELLATION_REVIEW":
      return "inProgress";
    case "APPROVED":
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
    case "EXPIRED":
      return "rejected";
    default:
      return "pending";
  }
}

function mapEmployerTask(task: EmployerTaskApi, proposalCount: number): Task {
  const createdAt = new Date(task.created_at).getTime();

  return {
    id: task.task_id,
    title: task.title,
    description: task.description,
    status: mapTaskStatus(task.status),
    budget: task.currency_code === "IRR" ? task.wage_budget_amount / 10 : task.wage_budget_amount,
    date: new Date(task.created_at).toLocaleDateString("fa-IR"),
    createdAt: Number.isNaN(createdAt) ? 0 : createdAt,
    proposals: proposalCount,
    raw: task,
  };
}

const statusLabels: Record<TaskStatus, string> = {
  pending: "در انتظار پذیرش",
  inProgress: "در حال انجام",
  completed: "تکمیل‌شده",
  rejected: "لغوشده",
};

const tabs: { label: string; value: "all" | TaskStatus }[] = [
  { label: "همه کارها", value: "all" },
  { label: "در انتظار پذیرش", value: "pending" },
  { label: "در حال انجام", value: "inProgress" },
  { label: "تکمیل‌شده", value: "completed" },
  { label: "لغوشده", value: "rejected" },
];

function formatPrice(price: number) {
  return new Intl.NumberFormat("fa-IR").format(price);
}

export default function MyTasksPage() {
  const [taskItems, setTaskItems] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadTasks() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [tasks, bids] = await Promise.all([
          getEmployerTasks(),
          getEmployerBids(),
        ]);

        if (!isActive) return;

        const proposalCounts = new Map<string, number>();
        for (const bid of bids) {
          proposalCounts.set(
            bid.task_id,
            (proposalCounts.get(bid.task_id) ?? 0) + 1,
          );
        }

        setTaskItems(
          tasks.map((task) =>
            mapEmployerTask(task, proposalCounts.get(task.task_id) ?? 0),
          ),
        );
      } catch (error) {
        if (!isActive) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "دریافت کارها با خطا مواجه شد.",
        );
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadTasks();

    return () => {
      isActive = false;
    };
  }, []);
  const [activeTab, setActiveTab] = useState<"all" | TaskStatus>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [cancelTaskId, setCancelTaskId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // محاسبه آمار کارها
  const taskStatistics = useMemo(
    () => ({
      total: taskItems.length,
      pending: taskItems.filter((task) => task.status === "pending").length,
      inProgress: taskItems.filter(
        (task) => task.status === "inProgress"
      ).length,
      completed: taskItems.filter(
        (task) => task.status === "completed"
      ).length,
    }),
    [taskItems]
  );

  // فیلتر، جست‌وجو و مرتب‌سازی کارها
  const visibleTasks = useMemo(() => {
    let result = [...taskItems];

    if (activeTab !== "all") {
      result = result.filter((task) => task.status === activeTab);
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();

      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description.toLowerCase().includes(query)
      );
    }

    if (sortOrder === "newest") {
      result.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortOrder === "oldest") {
      result.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortOrder === "highest") {
      result.sort((a, b) => b.budget - a.budget);
    } else if (sortOrder === "lowest") {
      result.sort((a, b) => a.budget - b.budget);
    }

    return result;
  }, [taskItems, activeTab, search, sortOrder]);

  const selectedTask = taskItems.find(
    (task) => task.id === cancelTaskId
  );

  async function handleConfirmCancel() {
    if (!cancelTaskId) return;
    setIsCancelling(true);
    setActionError(null);
    try {
      await cancelEmployerTask(cancelTaskId);
      setTaskItems((previous) => previous.map((task) =>
        task.id === cancelTaskId ? { ...task, status: "rejected" } : task
      ));
      setCancelTaskId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "لغو کار انجام نشد.");
    } finally {
      setIsCancelling(false);
    }
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setEditedTitle(task.raw.title);
    setActionError(null);
  }

  async function handleEditTask() {
    if (!editingTask || !editedTitle.trim()) return;
    setIsEditing(true);
    setActionError(null);
    try {
      const updated = await updateEmployerTask(editingTask.id, { title: editedTitle.trim() });
      setTaskItems((previous) => previous.map((item) =>
        item.id === editingTask.id ? { ...item, title: updated.title, raw: updated } : item
      ));
      setEditingTask(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "ویرایش کار انجام نشد.");
    } finally {
      setIsEditing(false);
    }
  }

  function handleCloseModal() {
    setCancelTaskId(null);
  }

  return (
    <DashboardLayout
      title="کارهای من"
      description="کارهای ثبت‌شده خود را مشاهده و مدیریت کنید."
      action={
        <Link href="/employer/tasks/create" className={styles.createButton}>
          <span>+</span>
          ثبت کار جدید
        </Link>
      }
    >
      <section className={styles.taskPage}>
        {/* آمار کارها */}
        <div className={styles.statistics}>
          <div className={styles.statCard}>
            <div>
              <strong>{formatPrice(taskStatistics.total)}</strong>
              <span>همه کارها</span>
            </div>
            <span className={`${styles.statIcon} ${styles.totalIcon}`}>
              ▤
            </span>
          </div>

          <div className={styles.statCard}>
            <div>
              <strong>{formatPrice(taskStatistics.pending)}</strong>
              <span>در انتظار پذیرش</span>
            </div>
            <span className={`${styles.statIcon} ${styles.pendingIcon}`}>
              ◷
            </span>
          </div>

          <div className={styles.statCard}>
            <div>
              <strong>{formatPrice(taskStatistics.inProgress)}</strong>
              <span>در حال انجام</span>
            </div>
            <span className={`${styles.statIcon} ${styles.progressIcon}`}>
              ◈
            </span>
          </div>

          <div className={styles.statCard}>
            <div>
              <strong>{formatPrice(taskStatistics.completed)}</strong>
              <span>تکمیل‌شده</span>
            </div>
            <span className={`${styles.statIcon} ${styles.completedIcon}`}>
              ✓
            </span>
          </div>
        </div>

        <section className={styles.taskPanel}>
          {/* فیلتر وضعیت */}
          <nav className={styles.tabs} aria-label="فیلتر وضعیت کارها">
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
                placeholder="جست‌وجو در کارها..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <span aria-hidden="true">⌕</span>
            </label>
          </div>

          {/* فهرست کارها */}
          <div className={styles.taskList}>
            {isLoading ? (
              <div className={styles.emptyState}>
                <strong>در حال دریافت کارها...</strong>
              </div>
            ) : loadError ? (
              <div className={styles.emptyState}>
                <strong>دریافت اطلاعات ناموفق بود</strong>
                <p>{loadError}</p>
                <button type="button" onClick={() => window.location.reload()}>
                  تلاش مجدد
                </button>
              </div>
            ) : visibleTasks.length > 0 ? (
              visibleTasks.map((task) => (
                <article className={styles.taskCard} key={task.id}>
                  <div className={styles.taskHeader}>
                    <div className={styles.taskTitleGroup}>
                      <h2>{task.title}</h2>
                      <p>{task.description}</p>
                    </div>

                    <span
                      className={`${styles.statusBadge} ${
                        styles[`status_${task.status}`]
                      }`}
                    >
                      {statusLabels[task.status]}
                    </span>
                  </div>

                  {expandedTask === task.id && (
                    <div className={styles.expandedDetails}>
                      <p>شرح کار: {task.description}</p>
                      <p>تاریخ ثبت: {task.date}</p>
                      <p>تعداد پیشنهادهای ثبت‌شده: {formatPrice(task.proposals)}</p>
                    </div>
                  )}

                  <div className={styles.taskMeta}>
                    <div>
                      <span>بودجه:</span>
                      <strong>{formatPrice(task.budget)} تومان</strong>
                    </div>

                    <div>
                      <span>تاریخ ثبت:</span>
                      <strong>{task.date}</strong>
                    </div>

                    {/* فقط کارهای در انتظار پذیرش پیشنهاد دریافتی دارند */}
                    {task.status === "pending" && (
                      <span className={styles.proposalCount}>
                        ▧ {formatPrice(task.proposals)} پیشنهاد دریافتی
                      </span>
                    )}
                  </div>

                  <div className={styles.taskActions}>
                    <div className={styles.secondaryActions}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTask(
                            expandedTask === task.id ? null : task.id
                          )
                        }
                      >
                        {expandedTask === task.id
                          ? "بستن جزئیات"
                          : "مشاهده جزئیات"}
                      </button>

                      {task.status !== "completed" &&
                        task.status !== "rejected" && (
                          <>
                            <button
                              type="button"
                              className={styles.editButton}
                              onClick={() => openEditTask(task)}
                            >
                              ویرایش عنوان
                            </button>

                            <button
                              type="button"
                              className={styles.cancelButton}
                              onClick={() => setCancelTaskId(task.id)}
                            >
                              لغو کار
                            </button>
                          </>
                        )}
                    </div>

                    {/* فقط برای کارهای در انتظار پذیرش */}
                    {task.status === "pending" && (
                      <Link
                        href={`/employer/tasks/${task.id}/proposals`}
                        className={styles.receivedBidsButton}
                      >
                        مشاهده پیشنهادها
                        <span>←</span>
                      </Link>
                    )}
                  </div>
                </article>
              ))
            
) : taskItems.length === 0 ? (
  <div className={styles.emptyState}>
    <span aria-hidden="true">▤</span>

    <strong>هنوز کاری ثبت نکرده‌اید.</strong>

    <p>
      برای شروع، اولین کار خود را ثبت کنید.
      پس از ثبت کار، اطلاعات آن در این قسمت نمایش داده می‌شود.
    </p>

    <Link
      href="/employer/tasks/create"
      className={styles.createButton}
    >
      + ثبت کار جدید
    </Link>
  </div>
    ) : (
      <div className={styles.emptyState}>
        <span aria-hidden="true">⌕</span>
    
        <strong>کاری با این مشخصات پیدا نشد.</strong>
    
        <p>
          هیچ کاری با عبارت جست‌وجو یا فیلتر انتخاب‌شده مطابقت ندارد.
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
        )
        }
          </div>

          {/* مرتب‌سازی و تعداد کارهای نمایش‌داده‌شده */}
          <div className={styles.panelFooter}>
            <span>
              نمایش {formatPrice(visibleTasks.length)} کار
            </span>

            <label>
              مرتب‌سازی:
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              >
                <option value="newest">جدیدترین</option>
                <option value="oldest">قدیمی‌ترین</option>
                <option value="highest">بیشترین بودجه</option>
                <option value="lowest">کمترین بودجه</option>
              </select>
            </label>
          </div>
        </section>
      </section>

      {/* پنجره تأیید لغو کار */}
      {cancelTaskId !== null && selectedTask && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseModal();
            }
          }}
        >
          <section
            className={styles.cancelModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
            aria-describedby="cancel-modal-description"
          >
            <button
              type="button"
              className={styles.modalClose}
              onClick={handleCloseModal}
              aria-label="بستن پنجره"
            >
              ×
            </button>

            <div className={styles.cancelIcon} aria-hidden="true">
              !
            </div>

            <h2 id="cancel-modal-title">لغو کار</h2>

            <p id="cancel-modal-description">
              آیا مطمئن هستید که می‌خواهید این کار را لغو کنید؟
              {actionError && <span role="alert">{actionError}</span>}
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.keepTaskButton}
                onClick={handleCloseModal}
                disabled={isCancelling}
              >
                انصراف
              </button>

              <button
                type="button"
                className={styles.confirmCancelButton}
                onClick={() => void handleConfirmCancel()}
                disabled={isCancelling}
              >
                {isCancelling ? "در حال لغو..." : "لغو کار"}
              </button>
            </div>
          </section>
        </div>
      )}
      <VakaDialog
        open={!!editingTask}
        title="ویرایش عنوان کار"
        description={actionError || "عنوان جدید کار را وارد کنید."}
        inputValue={editedTitle}
        inputPlaceholder="عنوان کار"
        onInputChange={setEditedTitle}
        confirmLabel="ذخیره تغییرات"
        busy={isEditing}
        onCancel={() => setEditingTask(null)}
        onConfirm={() => void handleEditTask()}
      />
    </DashboardLayout>
  );
}
