"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import TaskDetail from "@/components/TaskDetail/TaskDetail";
import type { Task } from "@/components/TaskDetail/types";
import { getAccessToken } from "@/lib/auth-api";
import { getTaskCategories, type TaskCategory } from "@/lib/task-api";
import styles from "./HomePage.module.css";

type ApiLocation = {
  task_location_id: string;
  location_type: string;
  stop_order: number;
  city: string;
  region: string;
};

type ApiTask = {
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
  locations: ApiLocation[];
  published_at: string | null;
  created_at: string;
};

type ApiPage = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ApiTask[];
};

type Query = {
  category_id?: string;
  city?: string;
  region?: string;
  min_budget?: number;
  max_budget?: number;
  ordering?: string;
  page?: number;
  page_size?: number;
};

type SortMode = "newest" | "price-low" | "price-high" | "duration";

type FilterState = {
  minPrice: number;
  maxPrice: number;
  city: string;
  region: string;
  workTypes: string[];
  dateRanges: string[];
  durations: string[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(
  /\/+$/,
  "",
);

const PAGE_SIZE = 20;
const MAX_PRICE = 10000000;

const initialFilters: FilterState = {
  minPrice: 0,
  maxPrice: MAX_PRICE,
  city: "",
  region: "",
  workTypes: [],
  dateRanges: [],
  durations: [],
};

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

const toToman = (amount: number, currency: string) =>
  currency.toUpperCase() === "IRR" ? amount / 10 : amount;

const toRial = (toman: number) => Math.round(toman * 10);

function getErrorMessage(status: number, value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "detail" in value &&
    typeof value.detail === "string"
  ) {
    return value.detail;
  }

  if (status === 401) return "برای مشاهده تسک‌ها ابتدا وارد حساب کاربری شوید.";

  if (status === 403)
    return "حساب شما دسترسی لازم برای مشاهده تسک‌ها را ندارد.";

  if (status === 404) return "مسیر دریافت تسک‌ها در سرور پیدا نشد.";

  if (status >= 500) return "مشکلی در سرور پیش آمده است.";

  return "دریافت اطلاعات با خطا مواجه شد.";
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (!API_BASE) {
    throw new Error(
      "متغیر NEXT_PUBLIC_API_BASE_URL در .env.local تنظیم نشده است.",
    );
  }

  const token = getAccessToken();

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "اتصال به بک‌اند برقرار نشد. آدرس API و تنظیمات CORS را بررسی کنید.",
    );
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, data));
  }

  return data as T;
}

function fetchTasks(query: Query, signal?: AbortSignal) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  });

  return apiGet<ApiPage>(`/api/discovery/tasks/?${params.toString()}`, signal);
}

function fetchTaskDetail(id: string) {
  return apiGet<ApiTask>(`/api/discovery/tasks/${encodeURIComponent(id)}/`);
}

function shortAddress(city?: string | null, region?: string | null) {
  return [city, region].filter(Boolean).join("، ") || "موقعیت ثبت نشده";
}

function adaptTask(source: ApiTask): Task {
  const locations = [...(source.locations ?? [])].sort(
    (a, b) => a.stop_order - b.stop_order,
  );

  const origin =
    locations.find((location) =>
      /origin|pickup|source|مبدا|مبدأ/i.test(location.location_type),
    ) ?? locations[0];

  const destination =
    locations.find((location) =>
      /destination|dropoff|delivery|مقصد/i.test(location.location_type),
    ) ?? locations[locations.length - 1];

  const isRoute = locations.length > 1;

  const fixed = locations[0];

  const addressOf = (location?: ApiLocation): string =>
    [location?.city, location?.region].filter(Boolean).join("، ");

  const currency = source.currency_code || "IRR";

  return {
    id: source.task_id,

    categoryId: source.category_id,
    categoryName: source.category_name,

    title: source.title,
    description: source.description,
    deliveryCriteria: source.delivery_criteria,

    estimatedDurationMinutes: source.estimated_duration_minutes,

    wageBudgetAmount: toToman(source.wage_budget_amount, currency),

    itemCostCapAmount:
      source.item_cost_cap_amount == null
        ? null
        : toToman(source.item_cost_cap_amount, currency),

    currencyCode: currency,

    invoiceRequired: source.receipt_required,

    goodsPurchaseRequired:
      source.item_cost_cap_amount != null && source.item_cost_cap_amount > 0,

    executionStartTime: source.execution_window_start_at,

    executionWindowEndAt: source.execution_window_end_at,

    proposalDeadlineAt: source.proposal_deadline_at,

    locationMode: isRoute ? "route" : "fixed",

    locationCity: fixed?.city,
    locationRegion: fixed?.region,
    locationAddress: addressOf(fixed),

    originCity: origin?.city,
    originRegion: origin?.region,
    originAddress: addressOf(origin),

    destinationCity: destination?.city,
    destinationRegion: destination?.region,
    destinationAddress: addressOf(destination),

    icon: isRoute ? "boxes" : "pin",
  };
}

function formatDate(value: string) {
  if (!value) return "زمان ثبت نشده";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "زمان ثبت نشده";
  }

  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function dayDifference(value: string, now: number | null): number | null {
  if (now === null || !value) return null;

  const target = new Date(value);
  const today = new Date(now);

  if (Number.isNaN(target.getTime())) return null;

  // Both values use the same calendar-day convention.
  const targetDay = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );

  const currentDay = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return Math.round((targetDay - currentDay) / 86400000);
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "arrow-left":
      return (
        <svg {...common}>
          <path d="M20 12H4m7-7-7 7 7 7" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );

    case "grid":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      );

    case "list":
      return (
        <svg {...common}>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth="3" />
        </svg>
      );

    case "filter":
      return (
        <svg {...common}>
          <path d="M4 6h16M7 12h10m-7 6h4" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="16" rx="2" />
          <path d="M7.5 3v4M16.5 3v4M4 9h16" />
        </svg>
      );

    case "pin":
      return (
        <svg {...common}>
          <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
          <circle cx="12" cy="10" r="2" />
        </svg>
      );

    case "boxes":
      return (
        <svg {...common}>
          <path d="m4 5 5-2 5 2-5 2-5-2Z" />
          <path d="M4 5v6l5 2v-6M14 5v6l-5 2" />
          <path d="m11 14 5-2 5 2-5 2-5-2Z" />
          <path d="M11 14v6l5 2v-6m5-2v6l-5 2" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      );
  }
}

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);

  const [activeCategory, setActiveCategory] = useState("all");

  const [expandedCategory, setExpandedCategory] = useState("");

  const [view, setView] = useState<"list" | "grid">("list");

  const [sort, setSort] = useState<SortMode>("newest");

  const [filters, setFilters] = useState<FilterState>(initialFilters);

  const [draft, setDraft] = useState<FilterState>(initialFilters);

  const [filterOpen, setFilterOpen] = useState(false);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [detailError, setDetailError] = useState<string | null>(null);

  const [totalCount, setTotalCount] = useState(0);

  const [nextPage, setNextPage] = useState<number | null>(null);

  const [reload, setReload] = useState(0);

  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCurrentTime(Date.now());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;

    getTaskCategories()
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setCategoryError(
            reason instanceof Error
              ? reason.message
              : "خطا در دریافت دسته‌بندی‌ها",
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!filterOpen) return;

    const oldOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen]);

  const ordering =
    sort === "price-low"
      ? "wage_budget_amount"
      : sort === "price-high"
        ? "-wage_budget_amount"
        : sort === "duration"
          ? "estimated_duration_minutes"
          : "-published_at";

  const query = useMemo<Query>(() => {
    const result: Query = {
      ordering,
      page: 1,
      page_size: PAGE_SIZE,
      min_budget: toRial(filters.minPrice),
      ...(filters.maxPrice < MAX_PRICE
        ? { max_budget: toRial(filters.maxPrice) }
        : {}),
    };

    if (filters.city.trim()) {
      result.city = filters.city.trim();
    }

    if (filters.region.trim()) {
      result.region = filters.region.trim();
    }

    if (activeCategory !== "all") {
      result.category_id = activeCategory;
    }

    return result;
  }, [
    ordering,
    filters.minPrice,
    filters.maxPrice,
    filters.city,
    filters.region,
    activeCategory,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    fetchTasks(query, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;

        setTasks(page.results.map(adaptTask));
        setTotalCount(page.count);
        setNextPage(page.next ? 2 : null);
        setError(null);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;

        setError(
          reason instanceof Error
            ? reason.message
            : "دریافت کارها با خطا مواجه شد.",
        );

        setLoading(false);
      });

    return () => controller.abort();
  }, [query, reload]);

  async function loadMore() {
    if (loading || loadingMore || nextPage === null) {
      return;
    }

    const currentPage = nextPage;

    setLoadingMore(true);

    try {
      const page = await fetchTasks({
        ...query,
        page: currentPage,
      });

      setTasks((previous) => [...previous, ...page.results.map(adaptTask)]);

      setNextPage(page.next ? currentPage + 1 : null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "دریافت صفحه بعد با خطا مواجه شد.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function openDetail(task: Task) {
    setSelectedTask(task);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const response = await fetchTaskDetail(String(task.id));
      const result = adaptTask(response);

      setSelectedTask((previous) =>
        previous?.id === task.id ? result : previous,
      );
    } catch (reason) {
      setDetailError(
        reason instanceof Error
          ? reason.message
          : "دریافت جزئیات تسک با خطا مواجه شد.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const typeMatch =
        filters.workTypes.length === 0 ||
        (filters.workTypes.includes("fixed") &&
          task.locationMode === "fixed") ||
        (filters.workTypes.includes("route") && task.locationMode === "route");

      const days = dayDifference(task.executionStartTime, currentTime);

      const dateMatch =
        filters.dateRanges.length === 0 ||
        (filters.dateRanges.includes("today") && days === 0) ||
        (filters.dateRanges.includes("future") &&
          days !== null &&
          days >= 3 &&
          days <= 5);

      const duration = task.estimatedDurationMinutes;

      const durationMatch =
        filters.durations.length === 0 ||
        filters.durations.some((range) => {
          if (range === "under15") return duration < 15;
          if (range === "15-20") return duration >= 15 && duration <= 20;
          if (range === "20-60") return duration > 20 && duration <= 60;
          if (range === "60-180") return duration > 60 && duration <= 180;

          return duration > 180;
        });

      return typeMatch && dateMatch && durationMatch;
    });
  }, [tasks, filters, currentTime]);

  function toggleDraft(
    field: "workTypes" | "dateRanges" | "durations",
    value: string,
  ) {
    setDraft((previous) => ({
      ...previous,
      [field]: previous[field].includes(value)
        ? previous[field].filter((item) => item !== value)
        : [...previous[field], value],
    }));
  }

  function resetFilters() {
    setDraft({ ...initialFilters });
  }

  function applyFilters() {
    setFilters({
      ...draft,
      workTypes: [...draft.workTypes],
      dateRanges: [...draft.dateRanges],
      durations: [...draft.durations],
    });

    setFilterOpen(false);
  }

  const topCategories = categories.filter((item) => !item.parent_category_id);

  const modal =
    filterOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className={styles.advancedBackdrop}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setFilterOpen(false);
              }
            }}
          >
            <section
              className={styles.advancedModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="filter-title"
            >
              <header className={styles.advancedHeader}>
                <button
                  type="button"
                  className={styles.advancedClose}
                  aria-label="بستن"
                  onClick={() => setFilterOpen(false)}
                >
                  ×
                </button>

                <h2 id="filter-title">
                  <Icon name="filter" size={18} />
                  فیلترهای پیشرفته
                </h2>

                <button
                  type="button"
                  className={styles.clearAll}
                  onClick={resetFilters}
                >
                  پاک کردن همه
                </button>
              </header>

              <div className={styles.advancedContent}>
                <div className={styles.filterSectionTitle}>
                  بازه بودجه (تومان)
                </div>

                <div className={styles.priceInputs}>
                  <label>
                    از
                    <input
                      type="number"
                      min={0}
                      max={draft.maxPrice}
                      value={draft.minPrice}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          minPrice: Math.min(
                            Math.max(Number(event.target.value), 0),
                            previous.maxPrice,
                          ),
                        }))
                      }
                    />
                  </label>

                  <label>
                    تا
                    <input
                      type="number"
                      min={draft.minPrice}
                      value={draft.maxPrice}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          maxPrice: Math.max(
                            Number(event.target.value),
                            previous.minPrice,
                          ),
                        }))
                      }
                    />
                  </label>
                </div>

                <div className={styles.rangeTrack}>
                  <div
                    className={styles.rangeFill}
                    style={{
                      left: `${100 - (draft.maxPrice / MAX_PRICE) * 100}%`,
                      right: `${(draft.minPrice / MAX_PRICE) * 100}%`,
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={MAX_PRICE}
                    step={50000}
                    value={draft.minPrice}
                    aria-label="حداقل بودجه"
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        minPrice: Math.min(
                          Number(event.target.value),
                          previous.maxPrice,
                        ),
                      }))
                    }
                  />
                  <input
                    type="range"
                    min={0}
                    max={MAX_PRICE}
                    step={50000}
                    value={Math.min(draft.maxPrice, MAX_PRICE)}
                    aria-label="حداکثر بودجه"
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        maxPrice: Math.max(
                          Number(event.target.value),
                          previous.minPrice,
                        ),
                      }))
                    }
                  />
                </div>

                <div className={styles.filterColumns}>
                  <div>
                    <div className={styles.filterSectionTitle}>نوع کار</div>

                    {[
                      ["fixed", "در یک محل انجام می‌شود"],
                      ["route", "دارای مبدأ و مقصد"],
                    ].map(([value, label]) => (
                      <label key={value} className={styles.checkLine}>
                        <input
                          type="checkbox"
                          checked={draft.workTypes.includes(value)}
                          onChange={() => toggleDraft("workTypes", value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <div>
                    <div className={styles.filterSectionTitle}>
                      زمان انجام کار
                    </div>

                    {[
                      ["today", "امروز"],
                      ["future", "۳ تا ۵ روز آینده"],
                    ].map(([value, label]) => (
                      <label key={value} className={styles.checkLine}>
                        <input
                          type="checkbox"
                          checked={draft.dateRanges.includes(value)}
                          onChange={() => toggleDraft("dateRanges", value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className={styles.locationFields}>
                  <label>
                    <span>شهر</span>
                    <input
                      placeholder="همه شهرها"
                      value={draft.city}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          city: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>منطقه</span>
                    <input
                      placeholder="همه مناطق"
                      value={draft.region}
                      onChange={(event) =>
                        setDraft((previous) => ({
                          ...previous,
                          region: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <div className={styles.durationHeading}>مدت زمان تقریبی</div>

                <div className={styles.durationOptions}>
                  {[
                    ["under15", "کمتر از ۱۵ دقیقه"],
                    ["15-20", "۱۵ تا ۲۰ دقیقه"],
                    ["20-60", "۲۰ تا ۶۰ دقیقه"],
                    ["60-180", "۱ تا ۳ ساعت"],
                    ["over180", "بیش از ۳ ساعت"],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="checkbox"
                        checked={draft.durations.includes(value)}
                        onChange={() => toggleDraft("durations", value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <footer className={styles.advancedFooter}>
                <button
                  type="button"
                  className={styles.applyFilters}
                  onClick={applyFilters}
                  aria-label="اعمال فیلترهای انتخاب‌شده"
                >
                  <Icon name="filter" size={17} />
                  <span>اعمال فیلترها</span>
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <main
      dir="rtl"
      className={`${styles.page} ${
        selectedTask ? styles.pageShowingDetail : ""
      }`}
    >
      {!selectedTask && (
        <div className={styles.homeDecorations} aria-hidden="true">
          <div className={styles.decorCircle} />
          <div className={styles.decorLines} />
          <div className={styles.decorArcTwo} />
          <div className={styles.decorMintSweep} />
          <div className={styles.decorPeach} />
          <div className={styles.decorPeachHighlight} />
        </div>
      )}

      <div
        className={`${styles.layout} ${
          selectedTask ? styles.detailLayout : ""
        }`}
      >
        {selectedTask ? (
          <div className={styles.detailContainer}>
            {detailLoading && (
              <div className={styles.apiState} role="status">
                در حال دریافت جزئیات تسک...
              </div>
            )}

            {detailError && (
              <div className={styles.apiState} role="alert">
                {detailError}
              </div>
            )}

            <TaskDetail
              task={selectedTask}
              onBack={() => {
                setSelectedTask(null);
                setDetailError(null);
              }}
            />
          </div>
        ) : (
          <>
            <aside className={styles.sidebar} aria-label="دسته‌بندی کارها">
              <div className={styles.sidebarHeading}>دسته‌بندی کارها</div>

              <button
                type="button"
                className={`${styles.allCategory} ${
                  activeCategory === "all" ? styles.categoryActive : ""
                }`}
                onClick={() => setActiveCategory("all")}
              >
                همه کارها
                <Icon name="chevron" size={16} />
              </button>

              {categoryError && (
                <div className={styles.apiState} role="alert">
                  {categoryError}
                </div>
              )}

              <nav className={styles.categoryNav}>
                {topCategories.map((category) => {
                  const expanded = expandedCategory === category.category_id;

                  return (
                    <div
                      className={styles.categoryGroup}
                      key={category.category_id}
                    >
                      <button
                        type="button"
                        className={`${styles.categoryButton} ${
                          activeCategory === category.category_id
                            ? styles.categorySelected
                            : ""
                        }`}
                        aria-expanded={expanded}
                        onClick={() => {
                          setExpandedCategory(
                            expanded ? "" : category.category_id,
                          );

                          setActiveCategory(category.category_id);
                        }}
                      >
                        {category.name}
                        <Icon name="chevron" size={15} />
                      </button>

                      {expanded && (
                        <div className={styles.subCategories}>
                          {categories
                            .filter(
                              (item) =>
                                item.parent_category_id ===
                                category.category_id,
                            )
                            .map((child) => (
                              <button
                                type="button"
                                key={child.category_id}
                                className={styles.subCategory}
                                onClick={() =>
                                  setActiveCategory(child.category_id)
                                }
                              >
                                <span className={styles.subDot} />
                                {child.name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </aside>

            <section className={styles.mainContent}>
              <div className={styles.intro}>
                <h1>کارهای مناسب مهارتتان را پیدا کنید</h1>
                <p>
                  بین فرصت‌های متنوع کار دلخواه خودتان را جستجو و پیشنهاد خود را
                  ثبت کنید.
                </p>
              </div>

              <div className={styles.toolbar}>
                <div className={styles.toolbarRight}>
                  <label className={styles.sortSelect}>
                    <select
                      value={sort}
                      onChange={(event) =>
                        setSort(event.target.value as SortMode)
                      }
                    >
                      <option value="newest">مرتب‌سازی: جدیدترین</option>
                      <option value="price-low">کمترین قیمت</option>
                      <option value="price-high">بیشترین قیمت</option>
                      <option value="duration">کمترین زمان انجام</option>
                    </select>
                    <Icon name="chevron" size={15} />
                  </label>

                  <div className={styles.viewToggle}>
                    <button
                      type="button"
                      className={view === "list" ? styles.viewActive : ""}
                      onClick={() => setView("list")}
                      aria-label="نمایش لیستی"
                    >
                      <Icon name="list" size={18} />
                    </button>

                    <button
                      type="button"
                      className={view === "grid" ? styles.viewActive : ""}
                      onClick={() => setView("grid")}
                      aria-label="نمایش شبکه‌ای"
                    >
                      <Icon name="grid" size={18} />
                    </button>
                  </div>
                </div>

                <div className={styles.toolbarLeft}>
                  <button
                    type="button"
                    className={styles.advancedFilter}
                    onClick={() => {
                      setDraft({
                        ...filters,
                        workTypes: [...filters.workTypes],
                        dateRanges: [...filters.dateRanges],
                        durations: [...filters.durations],
                      });
                      setFilterOpen(true);
                    }}
                  >
                    فیلترهای پیشرفته
                    <Icon name="filter" size={17} />
                  </button>

                  <span className={styles.resultCount}>
                    نتیجه: {money(filteredTasks.length)} از {money(totalCount)}{" "}
                    کار
                  </span>
                </div>
              </div>

              <div
                className={`${styles.taskList} ${
                  view === "grid" ? styles.taskGrid : ""
                }`}
              >
                {loading && (
                  <div className={styles.apiState} role="status">
                    در حال دریافت تسک‌ها...
                  </div>
                )}

                {error && (
                  <div className={styles.apiState} role="alert">
                    {error}
                    <button
                      type="button"
                      onClick={() => setReload((value) => value + 1)}
                    >
                      تلاش مجدد
                    </button>
                  </div>
                )}

                {!loading &&
                  filteredTasks.map((task) => (
                    <article key={task.id} className={styles.taskCard}>
                      <div className={styles.taskIcon}>
                        <Icon name={task.icon || "boxes"} size={55} />
                      </div>

                      <div className={styles.taskInfo}>
                        <div className={styles.tags}>
                          {task.urgency === "urgent" && (
                            <span className={styles.urgentTag}>فوری</span>
                          )}

                          <span className={styles.locationTag}>
                            {task.locationMode === "route"
                              ? "دارای مبدأ و مقصد"
                              : "در یک محل"}
                          </span>
                        </div>

                        <h2>{task.title}</h2>

                        <p className={styles.description}>{task.description}</p>

                        <div className={styles.locationLine}>
                          {task.locationMode === "route" ? (
                            <div className={styles.routeSummary}>
                              <span className={styles.routeOrigin}>
                                <strong>مبدأ:</strong>{" "}
                                {shortAddress(
                                  task.originCity,
                                  task.originRegion,
                                )}
                              </span>

                              <span className={styles.routeSummaryArrow}>
                                <Icon name="arrow-left" size={24} />
                              </span>

                              <span className={styles.routeDestination}>
                                <strong>مقصد:</strong>{" "}
                                {shortAddress(
                                  task.destinationCity,
                                  task.destinationRegion,
                                )}
                              </span>
                            </div>
                          ) : (
                            <strong>
                              {shortAddress(
                                task.locationCity,
                                task.locationRegion,
                              )}
                            </strong>
                          )}
                        </div>

                        <div className={styles.metaRow}>
                          <span>
                            <Icon name="calendar" size={17} />
                            {formatDate(task.executionStartTime)}
                          </span>

                          <span>
                            <Icon name="clock" size={17} />
                            حدود {money(task.estimatedDurationMinutes)} دقیقه
                          </span>
                        </div>
                      </div>

                      <div className={styles.taskActions}>
                        <div className={styles.price}>
                          <strong>{money(task.wageBudgetAmount)}</strong>

                          <span>
                            {task.currencyCode === "IRR" ||
                            task.currencyCode === "IRT"
                              ? "تومان"
                              : task.currencyCode}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={styles.proposalButton}
                          onClick={() => void openDetail(task)}
                        >
                          مشاهده و پیشنهاد
                        </button>
                      </div>
                    </article>
                  ))}

                {!loading && !error && filteredTasks.length === 0 && (
                  <div className={styles.emptyState}>
                    <Icon name="search" size={32} />
                    <strong>کاری با این مشخصات پیدا نشد</strong>
                    <span>
                      فیلترها را تغییر دهید یا جستجوی دیگری انجام دهید.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory("all");
                        setFilters({
                          ...initialFilters,
                        });
                      }}
                    >
                      نمایش همه کارها
                    </button>
                  </div>
                )}

                {!loading && nextPage !== null && (
                  <button
                    type="button"
                    className={styles.loadMoreButton}
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "در حال دریافت..." : "نمایش کارهای بیشتر"}
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {modal}
    </main>
  );
}
