"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getAccessToken } from "@/lib/auth-api";
import type { Task } from "@/components/TaskDetail/types";
import styles from "./TaskDetail.module.css";

/* ============================================
   Types
============================================ */

type DiscoveryLocation = {
  task_location_id: string;
  location_type: string;
  stop_order: number;
  city: string;
  region: string;
};

type DiscoveryTask = {
  task_id: string;
  category_id: string;
  category_name: string;
  title: string;
  description: string;
  delivery_criteria: string;
  status: string;
  estimated_duration_minutes: number;
  wage_budget_amount: number;
  item_cost_cap_amount: number | null;
  currency_code: string;
  receipt_required: boolean;
  execution_window_start_at: string;
  execution_window_end_at: string;
  proposal_deadline_at: string;
  deadline_at: string | null;
  locations: DiscoveryLocation[];
};

export type EmployerInfo = {
  name: string;
  joinedAt?: string;
  postedTasks?: number;
  completionRate?: number;
};

type TaskDetailProps = {
  task: Task;
  onBack: () => void;
  employer?: EmployerInfo;
};

type DetailResult =
  | {
      taskId: string;
      status: "success";
      task: Task;
    }
  | {
      taskId: string;
      status: "error";
      message: string;
    };

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

/* ============================================
   Helpers
============================================ */

function shortAddress(location?: DiscoveryLocation) {
  return [location?.city, location?.region].filter(Boolean).join("، ") || "";
}

function convertCurrency(amount: number, currency: string) {
  return currency.toUpperCase() === "IRR" ? amount / 10 : amount;
}

function formatDateTime(value?: string) {
  if (!value) return "ثبت نشده";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "زمان ثبت نشده";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function splitRouteAddress(address: string) {
  const parts = address
    .split("،")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) {
    return {
      main: address,
      details: "",
    };
  }

  return {
    main: parts.slice(0, 2).join("، "),
    details: parts.slice(2).join("، "),
  };
}

/* ============================================
   API
============================================ */

async function getTaskDetailFromApi(
  taskId: string,
  signal: AbortSignal,
): Promise<DiscoveryTask> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(
    /\/+$/,
    "",
  );

  if (!baseUrl) {
    throw new Error(
      "آدرس بک‌اند مشخص نشده است. NEXT_PUBLIC_API_BASE_URL را بررسی کنید.",
    );
  }

  const token = getAccessToken();

  let response: Response;

  try {
    response = await fetch(
      `${baseUrl}/api/discovery/tasks/${encodeURIComponent(taskId)}/`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
        signal,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "ارتباط با سرور برقرار نشد. آدرس بک‌اند و اتصال اینترنت را بررسی کنید.",
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    let message: string | null = null;

    if (
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof body.detail === "string"
    ) {
      message = body.detail;
    }

    if (!message) {
      switch (response.status) {
        case 401:
          message = "برای مشاهده جزئیات باید وارد حساب کاربری شوید.";
          break;

        case 403:
          message = "مجوز مشاهده این تسک را ندارید.";
          break;

        case 404:
          message = "این تسک پیدا نشد یا دیگر در دسترس نیست.";
          break;

        default:
          message = "دریافت جزئیات تسک با خطا مواجه شد.";
      }
    }

    throw new Error(message);
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("task_id" in body) ||
    typeof body.task_id !== "string"
  ) {
    throw new Error("اطلاعات دریافت‌شده از سرور معتبر نیست.");
  }

  return body as DiscoveryTask;
}

/* ============================================
   Adapter: API -> UI
============================================ */

function adaptDetailTask(source: DiscoveryTask): Task {
  const locations = [...(source.locations ?? [])].sort(
    (a, b) => a.stop_order - b.stop_order,
  );

  const origin =
    locations.find((location) =>
      /origin|pickup|source/i.test(location.location_type),
    ) ?? locations[0];

  const destination =
    locations.find((location) =>
      /destination|dropoff|delivery/i.test(location.location_type),
    ) ?? locations[locations.length - 1];

  const isRoute = locations.length > 1;
  const fixedLocation = locations[0];
  const currency = source.currency_code || "IRR";

  return {
    id: source.task_id,

    categoryId: source.category_id,
    categoryName: source.category_name,

    title: source.title,
    description: source.description,
    deliveryCriteria: source.delivery_criteria,

    estimatedDurationMinutes: source.estimated_duration_minutes,

    wageBudgetAmount: convertCurrency(source.wage_budget_amount, currency),

    itemCostCapAmount:
      source.item_cost_cap_amount === null
        ? null
        : convertCurrency(source.item_cost_cap_amount, currency),

    currencyCode: currency,

    goodsPurchaseRequired:
      source.item_cost_cap_amount != null && source.item_cost_cap_amount > 0,

    invoiceRequired: source.receipt_required,

    executionStartTime: source.execution_window_start_at,

    executionWindowEndAt: source.execution_window_end_at,

    proposalDeadlineAt: source.proposal_deadline_at,

    locationMode: isRoute ? "route" : "fixed",

    locationCity: fixedLocation?.city,
    locationRegion: fixedLocation?.region,
    locationAddress: shortAddress(fixedLocation),

    originCity: origin?.city,
    originRegion: origin?.region,
    originAddress: shortAddress(origin),

    destinationCity: destination?.city,
    destinationRegion: destination?.region,
    destinationAddress: shortAddress(destination),

    icon: isRoute ? "boxes" : "pin",
  };
}

/* ============================================
   Icons
============================================ */

function DetailIcon({ type }: { type: string }) {
  const common = {
    width: 23,
    height: 23,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const paths: Record<string, React.ReactNode> = {
    user: (
      <>
        <circle cx="12" cy="8" r="5" />
        <path d="M3 21c0-5 4-8 9-8s9 3 9 8" />
      </>
    ),

    flag: (
      <>
        <path d="M5 22V4" />
        <path d="M5 5c5-4 9 4 15 0v11c-6 4-10-4-15 0" />
      </>
    ),

    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),

    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 9h18M16 15h2" />
      </>
    ),

    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),

    map: (
      <>
        <path d="M12 21s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13Z" />
        <circle cx="12" cy="8" r="2.5" />
      </>
    ),

    arrow: (
      <>
        <path d="M5 12h14M12 5l7 7-7 7" />
      </>
    ),

    document: (
      <>
        <path d="M6 2h9l5 5v15H6z" />
        <path d="M15 2v6h5M9 13h8M9 17h8" />
      </>
    ),

    headset: (
      <>
        <path d="M3 13v-2a9 9 0 0 1 18 0v2" />
        <rect x="3" y="12" width="4" height="8" rx="2" />
        <rect x="17" y="12" width="4" height="8" rx="2" />
      </>
    ),

    bookmark: (
      <>
        <path d="M6 3h12v18l-6-4-6 4z" />
      </>
    ),

    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m9 11 6-5M9 13l6 5" />
      </>
    ),

    check: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m7 12 3 3 7-7" />
      </>
    ),

    box: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="8" rx="1" />
        <rect x="8" y="13" width="8" height="8" rx="1" />
      </>
    ),
  };

  return <svg {...common}>{paths[type] || paths.document}</svg>;
}

/* ============================================
   Original Figma UI - No CSS changes
============================================ */

function TaskDetailView({ task, onBack, employer }: TaskDetailProps) {
  const hasRoute = task.locationMode === "route";

  const fixedAddress =
    task.locationAddress ||
    [task.locationCity, task.locationRegion].filter(Boolean).join("، ");

  const originAddress =
    task.originAddress ||
    [task.originCity, task.originRegion].filter(Boolean).join("، ");

  const destinationAddress =
    task.destinationAddress ||
    [task.destinationCity, task.destinationRegion].filter(Boolean).join("، ");

  const originParts = splitRouteAddress(originAddress);
  const destinationParts = splitRouteAddress(destinationAddress);

  const locationQuery = hasRoute
    ? destinationAddress || originAddress
    : fixedAddress;

  const mapUrl = locationQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        locationQuery,
      )}`
    : undefined;

  const shareTask = async () => {
    const shareData = {
      title: task.title,
      text: task.description,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(
          `${task.title}\n${task.description}\n${window.location.href}`,
        );
      }
    } catch {
      // User cancelled sharing.
    }
  };

  return (
    <div className={styles.detailScene} dir="rtl">
      <div className={styles.detailDecorations} aria-hidden="true">
        <span className={styles.detailMintWash} />
        <span className={styles.detailTopMintDot} />
        <span className={styles.detailTopPeachDot} />
        <span className={styles.detailRightMintDot} />
        <span className={styles.detailPeachBlob} />
        <span className={styles.detailPeachBubble} />
        <span className={styles.detailMintBlob} />
      </div>

      <div className={styles.detailPage} dir="ltr">
        <main className={styles.detailMain} dir="rtl">
          <section className={styles.detailCard}>
            <button
              type="button"
              className={styles.detailBack}
              onClick={onBack}
            >
              بازگشت به کارها
            </button>

            <div className={styles.detailTop}>
              <div className={styles.detailText}>
                <div className={styles.detailTags}>
                  {task.urgency === "urgent" && (
                    <span className={styles.urgentTag}>فوری ✨</span>
                  )}

                  <span className={styles.negotiableTag}>
                    {hasRoute ? "دارای مبدا و مقصد" : "در یک محل"}
                  </span>
                </div>

                <h1>{task.title}</h1>
                <p>{task.description}</p>
              </div>

              <div className={styles.detailTaskIcon}>
                <DetailIcon type="box" />
              </div>
            </div>

            <div className={styles.detailStats}>
              <div className={styles.statBox}>
                <div>
                  <DetailIcon type="wallet" />
                  <strong>دستمزد مجری</strong>
                </div>
                <b>{money(task.wageBudgetAmount)}</b>
                <small>تومان</small>
              </div>

              <div className={styles.statBox}>
                <div>
                  <DetailIcon type="wallet" />
                  <strong>سقف خرید اقلام</strong>
                </div>

                <b>
                  {task.goodsPurchaseRequired && task.itemCostCapAmount != null
                    ? money(task.itemCostCapAmount)
                    : "نیازی ندارد"}
                </b>

                {task.goodsPurchaseRequired &&
                  task.itemCostCapAmount != null && <small>تومان</small>}
              </div>

              <div className={styles.statBox}>
                <div>
                  <DetailIcon type="clock" />
                  <strong>مدت انجام کار</strong>
                </div>

                <b>{money(task.estimatedDurationMinutes)}</b>
                <small>دقیقه</small>
              </div>

              <div className={styles.statBox}>
                <div>
                  <DetailIcon type="calendar" />
                  <strong>شروع انجام کار</strong>
                </div>

                <b>{formatDateTime(task.executionStartTime)}</b>

                <small>زمان شروع بازه اجرا</small>
              </div>
            </div>

            {hasRoute ? (
              <section
                className={styles.routeBox}
                aria-label="مسیر دریافت و تحویل"
              >
                <div
                  className={`${styles.routeLocation} ${styles.routeOrigin}`}
                >
                  <div className={styles.routeHeading}>
                    <span className={styles.originPin}>
                      <DetailIcon type="map" />
                    </span>
                    <strong>مبدأ (دریافت)</strong>
                  </div>

                  <p className={styles.routeAddressMain}>
                    {originParts.main || "مبدأ ثبت نشده است"}
                  </p>

                  {originParts.details && (
                    <p className={styles.routeAddressDetails}>
                      {originParts.details}
                    </p>
                  )}
                </div>

                <div className={styles.routeArrow} aria-hidden="true">
                  <DetailIcon type="arrow" />
                </div>

                <div
                  className={`${styles.routeLocation} ${styles.routeDestination}`}
                >
                  <div className={styles.routeHeading}>
                    <span className={styles.destinationPin}>
                      <DetailIcon type="map" />
                    </span>
                    <strong>مقصد (تحویل)</strong>
                  </div>

                  <p className={styles.routeAddressMain}>
                    {destinationParts.main || "مقصد ثبت نشده است"}
                  </p>

                  {destinationParts.details && (
                    <p className={styles.routeAddressDetails}>
                      {destinationParts.details}
                    </p>
                  )}
                </div>
              </section>
            ) : (
              <section className={styles.singleLocationBox}>
                <div className={styles.singleLocationInfo}>
                  <DetailIcon type="map" />

                  <div>
                    <strong>موقعیت انجام کار</strong>
                    <p>{fixedAddress || "مکان توسط کارفرما مشخص می‌شود"}</p>
                  </div>
                </div>

                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.mapButton}
                  >
                    <DetailIcon type="map" />
                    مشاهده روی نقشه
                  </a>
                )}
              </section>
            )}

            <section className={styles.descriptionBox}>
              <div className={styles.descriptionHeading}>
                <strong>شرح کامل کار</strong>
                <DetailIcon type="document" />
              </div>

              <p>{task.description}</p>

              {task.deliveryCriteria && (
                <div className={styles.deliveryCriteria}>
                  <strong>معیارهای تحویل کار</strong>
                  <p>{task.deliveryCriteria}</p>
                </div>
              )}
            </section>

            <div className={styles.detailActions}>
              <Link href="/login" className={styles.submitProposal}>
                ثبت پیشنهاد
                <DetailIcon type="check" />
              </Link>

              <button
                type="button"
                className={styles.shareButton}
                onClick={shareTask}
              >
                اشتراک‌گذاری
                <DetailIcon type="share" />
              </button>

              <button
                type="button"
                className={styles.favoriteButton}
                disabled
                title="این قابلیت هنوز فعال نشده است"
              >
                افزودن به علاقه‌مندی‌ها
                <DetailIcon type="bookmark" />
              </button>
            </div>
          </section>
        </main>

        <aside
          className={styles.employerSidebar}
          dir="rtl"
          aria-label="اطلاعات کارفرما"
        >
          <div className={styles.employerProfile}>
            <div className={styles.employerTitle}>
              <DetailIcon type="user" />
              <strong>کارفرما</strong>
            </div>

            <div className={styles.employerIdentity}>
              <DetailIcon type="user" />

              <div>
                <strong>{employer?.name || "نام کارفرما ثبت نشده"}</strong>

                <small>
                  {employer?.joinedAt
                    ? `عضویت: ${employer.joinedAt}`
                    : "اطلاعات عضویت موجود نیست"}
                </small>
              </div>
            </div>

            <div className={styles.employerMetrics}>
              <div>
                <strong>
                  {employer?.postedTasks == null
                    ? "—"
                    : money(employer.postedTasks)}
                </strong>
                <span>کار ثبت‌شده</span>
              </div>

              <div>
                <strong>
                  {employer?.completionRate == null
                    ? "—"
                    : `${money(employer.completionRate)}٪`}
                </strong>
                <span>نرخ تکمیل</span>
              </div>
            </div>
          </div>

          <div className={styles.employerFeature}>
            <DetailIcon type="lock" />

            <div>
              <strong>پرداخت امن واکا</strong>
              <p>مبلغ پس از انجام و تأیید کار به شما پرداخت می‌شود.</p>
            </div>
          </div>

          <div className={styles.employerFeature}>
            <DetailIcon type="headset" />

            <div>
              <strong>ضمانت و پشتیبانی</strong>
              <p>در صورت بروز مشکل، تیم واکا همراه شماست.</p>
            </div>
          </div>

          <div className={styles.employerFeature}>
            <DetailIcon type="flag" />

            <div>
              <strong>گزارش تخلف</strong>
              <p>گزارش موارد مغایر با قوانین واکا</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ============================================
   Connected TaskDetail
============================================ */

export default function TaskDetail({
  task,
  onBack,
  employer,
}: TaskDetailProps) {
  const taskId = String(task.id);

  const [result, setResult] = useState<DetailResult | null>(null);

  const currentResult = result?.taskId === taskId ? result : null;

  const loading = currentResult === null;

  useEffect(() => {
    const controller = new AbortController();

    async function loadTask() {
      try {
        const response = await getTaskDetailFromApi(taskId, controller.signal);

        if (controller.signal.aborted) return;

        setResult({
          taskId,
          status: "success",
          task: adaptDetailTask(response),
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        setResult({
          taskId,
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "دریافت جزئیات تسک امکان‌پذیر نشد.",
        });
      }
    }

    void loadTask();

    return () => {
      controller.abort();
    };
  }, [taskId]);

  const displayedTask =
    currentResult?.status === "success" ? currentResult.task : task;

  return (
    <>
      {loading && (
        <p
          role="status"
          aria-live="polite"
          style={{
            margin: "8px 14px",
            padding: "12px 16px",
            borderRadius: 14,
            background: "var(--vaka-surface, #fff)",
            color: "var(--vaka-text, #233a3b)",
            fontSize: 12,
            textAlign: "right",
          }}
        >
          در حال دریافت اطلاعات کامل تسک...
        </p>
      )}

      {currentResult?.status === "error" && (
        <p
          role="alert"
          style={{
            margin: "8px 14px",
            padding: "12px 16px",
            borderRadius: 14,
            background: "var(--vaka-surface, #fff)",
            color: "var(--vaka-text, #233a3b)",
            fontSize: 12,
            textAlign: "right",
          }}
        >
          {currentResult.message} اطلاعات اولیه کارت نمایش داده می‌شود.
        </p>
      )}

      <TaskDetailView
        task={displayedTask}
        onBack={onBack}
        employer={employer}
      />
    </>
  );
}
