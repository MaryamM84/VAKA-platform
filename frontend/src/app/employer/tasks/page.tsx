
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import styles from "./MyTasks.module.css";

type TaskStatus = "pending" | "inProgress" | "completed" | "rejected";

type Task = {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  budget: number;
  date: string;
  proposals: number;
};

const initialTasks: Task[] = [
  {
    id: 1,
    title: "طراحی رابط کاربری اپلیکیشن فروشگاهی",
    description:
      "طراحی کامل صفحات اپلیکیشن موبایل با تمرکز بر تجربه کاربری مدرن و ساده",
    status: "pending",
    budget: 18000000,
    date: "۱۴۰۵/۰۳/۲۵",
    proposals: 8,
  },
  {
    id: 2,
    title: "تدوین ویدیو معرفی محصول",
    description:
      "تدوین و آماده‌سازی ویدیوی معرفی محصول برای انتشار در شبکه‌های اجتماعی",
    status: "inProgress",
    budget: 3500000,
    date: "۱۴۰۵/۰۳/۱۸",
    proposals: 5,
  },
  {
    id: 3,
    title: "توسعه بخش پرداخت وب‌سایت",
    description:
      "پیاده‌سازی درگاه پرداخت و اتصال آن به بخش سفارش‌های وب‌سایت",
    status: "completed",
    budget: 12000000,
    date: "۱۴۰۵/۰۳/۱۰",
    proposals: 6,
  },
  {
    id: 4,
    title: "طراحی بنر کمپین پاییزه",
    description: "طراحی بنرهای تبلیغاتی برای کمپین پاییزه فروشگاه",
    status: "pending",
    budget: 5000000,
    date: "۱۴۰۵/۰۳/۰۵",
    proposals: 4,
  },
  {
    id: 5,
    title: "تولید محتوای شبکه‌های اجتماعی",
    description: "تهیه محتوای متنی و تصویری برای صفحه اینستاگرام برند",
    status: "rejected",
    budget: 2500000,
    date: "۱۴۰۵/۰۲/۲۸",
    proposals: 3,
  },
];

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
  const [taskItems, setTaskItems] = useState<Task[]>(initialTasks);
  const [activeTab, setActiveTab] = useState<"all" | TaskStatus>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [cancelTaskId, setCancelTaskId] = useState<number | null>(null);

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
      result.sort((a, b) => b.id - a.id);
    } else if (sortOrder === "oldest") {
      result.sort((a, b) => a.id - b.id);
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

  function handleConfirmCancel() {
    if (cancelTaskId === null) return;

    setTaskItems((previous) =>
      previous.map((task) =>
        task.id === cancelTaskId
          ? { ...task, status: "rejected" }
          : task
      )
    );

    setCancelTaskId(null);
    setExpandedTask(null);
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
            {visibleTasks.length > 0 ? (
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
                      این بخش فعلاً اطلاعات نمایشی بیشتری از کار را نشان
                      می‌دهد. در نسخه متصل به بک‌اند، جزئیات واقعی کار
                      در این قسمت قرار می‌گیرد.
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
                              onClick={() =>
                                alert(
                                  "ویرایش کار در مرحله بعد پیاده‌سازی می‌شود."
                                )
                              }
                            >
                              ویرایش
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
            ) : (
              <div className={styles.emptyState}>
                <span aria-hidden="true">⌕</span>
                <strong>کاری پیدا نشد</strong>
                <p>عبارت جست‌وجو یا فیلتر انتخاب‌شده را تغییر دهید.</p>
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
              آیا از لغو کار «{selectedTask.title}» مطمئن هستید؟
              <span>
                پس از تأیید، وضعیت این کار به لغوشده تغییر می‌کند.
              </span>
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.keepTaskButton}
                onClick={handleCloseModal}
              >
                انصراف
              </button>

              <button
                type="button"
                className={styles.confirmCancelButton}
                onClick={handleConfirmCancel}
              >
                بله، لغو شود
              </button>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
