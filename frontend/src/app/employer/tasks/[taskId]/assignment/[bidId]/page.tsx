"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";

import {
  getAssignmentPreview,
  confirmAssignment,
  trackingPath,
  getTaskBids,
  type AssignmentPreview,
  type AssignmentResult,
} from "@/lib/employer-api";

import {
  Card,
  Steps,
  Worker,
  money,
  date,
  duration,
} from "@/components/employer-workflow/shared";

import styles from "@/components/employer-workflow/Workflow.module.css";

function AssignmentContent() {
  const { taskId, bidId } = useParams<{
    taskId: string;
    bidId: string;
  }>();

  const [preview, setPreview] =
    useState<AssignmentPreview | null>(null);

  const [result, setResult] =
    useState<AssignmentResult | null>(null);

  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);

  const key = useRef<{
    bidId: string;
    value: string;
  } | null>(null);

  const back = `/employer/tasks/${encodeURIComponent(taskId)}/proposals`;

  useEffect(() => {
    const controller = new AbortController();
    let live = true;

    async function load() {
      setLoading(true);
      setError("");
      setPreview(null);
      setAccepted(false);
      setResult(null);

      try {
        const data = await getAssignmentPreview(
          bidId,
          controller.signal
        );

        if (
          data.task.task_id !== taskId ||
          data.bid.bid_id !== bidId
        ) {
          throw new Error(
            "این پیشنهاد متعلق به تسک انتخاب شده نیست."
          );
        }

        if (live) {
          setPreview(data);
        }
      } catch (err) {
        if (!live) return;

        try {
          const bids = await getTaskBids(taskId);

          if (!live) return;

          if (
            bids.some(
              (bid) =>
                bid.bid_id === bidId &&
                bid.status === "ACCEPTED"
            )
          ) {
            setAccepted(true);
            return;
          }
        } catch {
          // Keep the original error visible.
        }

        if (live) {
          setError(
            err instanceof Error
              ? err.message
              : "دریافت پیش‌نمایش رزرو ممکن نشد."
          );
        }
      } finally {
        if (live) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      live = false;
      controller.abort();
    };
  }, [taskId, bidId, reload]);

  useEffect(() => {
    const element = dialog.current;

    if (!element) return;

    if ((busy || result) && !element.open) {
      element.showModal();
    }

    if (!busy && !result && element.open) {
      element.close();
    }
  }, [busy, result]);

  async function confirm() {
    if (
      !preview?.can_confirm ||
      busy ||
      inFlight.current ||
      result
    ) {
      return;
    }

    inFlight.current = true;

    setBusy(true);
    setError("");

    try {
      // Persist only the idempotency key.
      // Prevent duplicate reservations after retries.

      const storageKey = `vaka.assignment-key.${bidId}`;

      if (!key.current || key.current.bidId !== bidId) {
        let stored: string | null = null;

        try {
          stored = sessionStorage.getItem(storageKey);
        } catch {
          // Storage may be disabled.
        }

        key.current = {
          bidId,
          value: stored || crypto.randomUUID(),
        };

        try {
          sessionStorage.setItem(
            storageKey,
            key.current.value
          );
        } catch {
          // Same-page retry still works.
        }
      }

      const response = await confirmAssignment(
        bidId,
        key.current.value
      );

      if (
        response.task_id !== taskId ||
        response.bid_id !== bidId ||
        response.status !== "ACCEPTED"
      ) {
        throw new Error(
          "پاسخ رزرو معتبر نیست. وضعیت تسک را دوباره بررسی کنید."
        );
      }

      setResult(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "رزرو وجه انجام نشد."
      );

      // Check whether acceptance succeeded on the server
      // before the network response was lost.

      try {
        const bids = await getTaskBids(taskId);

        if (
          bids.some(
            (bid) =>
              bid.bid_id === bidId &&
              bid.status === "ACCEPTED"
          )
        ) {
          setAccepted(true);
        }
      } catch {
        // Keep the original error.
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const r = preview?.reservation_preview;
  const w = preview?.wallet;

  return (
    <DashboardLayout
      title="تسک‌های من"
      description="کارهایی که ثبت کرده‌اید و وضعیت اجرای آن‌ها"
      variant="workflow"
      workflowSteps={<Steps stage={2} />}
    >
      <div className={styles.stack}>
        <Card>
          <div className={styles.row}>
            <span className={styles.badge}>
              مرحله پرداخت و رزرو امانی
            </span>

            <Link
              href={back}
              className={styles.muted}
            >
              بازگشت به پیشنهادها ←
            </Link>
          </div>

          <h2>تأیید پیشنهاد و رزرو وجه امانی</h2>

          <p className={styles.muted}>
            پیش از پذیرش پیشنهاد، مبلغ رزرو و موجودی کیف پول
            خود را بررسی کنید.
          </p>
        </Card>

        {loading && (
          <Card>
            <p role="status">
              در حال دریافت اطلاعات رزرو...
            </p>
          </Card>
        )}

        {error && (
          <Card>
            <p
              className={styles.error}
              role="alert"
            >
              {error}
            </p>

            <div className={styles.actions}>
              <button
                className="vaka-secondary-button"
                onClick={() => setReload((n) => n + 1)}
              >
                بررسی مجدد وضعیت
              </button>

              <Link
                className="vaka-secondary-button"
                href={back}
              >
                بازگشت
              </Link>
            </div>
          </Card>
        )}

        {accepted && (
          <Card>
            <h2>این پیشنهاد قبلاً پذیرفته شده است.</h2>

            <Link
              href={trackingPath(taskId)}
              className="vaka-primary-button"
            >
              پیگیری مأموریت
            </Link>
          </Card>
        )}

        {preview && r && w && !accepted && (
          <>
            {/* Task information */}

            <Card>
              <div className={styles.header}>
                <h2>تسک انتخاب شده کارفرما</h2>

                <span className={styles.badge}>
                  {preview.task.category_name}
                </span>
              </div>

              <h3>{preview.task.title}</h3>

              <p className={styles.muted}>
                {preview.task.description}
              </p>

              <p className={styles.muted}>
                {preview.task.locations
                  .map((location) =>
                    [location.city, location.region]
                      .filter(Boolean)
                      .join("، ")
                  )
                  .filter(Boolean)
                  .join(" • ")}
              </p>

              <p className={styles.muted}>
                بازه اجرا:{" "}
                {date(preview.task.execution_window_start_at)}
                {" تا "}
                {date(preview.task.execution_window_end_at)}
                {" | مهلت تحویل: "}
                {date(
                  preview.task.deadline_at ||
                    preview.task.execution_window_end_at
                )}
              </p>

              <span className={styles.badge}>
                {preview.task.receipt_required
                  ? "نیازمند فاکتور معتبر"
                  : "فاکتور الزامی نیست"}
              </span>
            </Card>

            {/* Selected worker */}

            <Card>
              <div className={styles.header}>
                <h2>مشخصات مجری منتخب شما</h2>

                <span className={styles.badge}>
                  پیشنهاد انتخاب شده
                </span>
              </div>

              <Worker
                id={preview.executor.profile_id}
                name={preview.executor.full_name}
                avatarId={preview.executor.avatar_id}
                avatarUrl={preview.executor.avatar_url}
                bio={preview.executor.bio}
                verified={
                  preview.executor.verification_status ===
                  "APPROVED"
                }
                rating={preview.executor.average_rating}
                completed={
                  preview.executor.completed_tasks_count
                }
              />

              <p className={styles.muted}>
                مدت پیشنهادی:{" "}
                {duration(
                  preview.bid.proposed_duration_minutes
                )}
              </p>

              {preview.bid.message && (
                <p>{preview.bid.message}</p>
              )}
            </Card>

            {/* Escrow and wallet information */}

            <Card>
              <div className={styles.header}>
                <h2>جزئیات و تفکیک مبالغ رزرو</h2>

                <span className={styles.muted}>
                  بر اساس محاسبه سرور
                </span>
              </div>

              <dl className={styles.amounts}>
                <div>
                  <dt>دستمزد پیشنهادی مجری</dt>

                  <dd>
                    {money(
                      r.labor_amount,
                      r.currency_code
                    )}
                  </dd>
                </div>

                <div>
                  <dt>سقف هزینه خرید اقلام</dt>

                  <dd>
                    {money(
                      r.expense_amount,
                      r.currency_code
                    )}
                  </dd>
                </div>

                <div>
                  <dt>
                    کارمزد پلتفرم (
                    {r.fee_payer === "WORKER"
                      ? "سهم مجری"
                      : r.fee_payer === "EMPLOYER"
                        ? "سهم کارفرما"
                        : r.fee_payer}
                    )
                  </dt>

                  <dd>
                    {money(
                      r.platform_fee_amount,
                      r.currency_code
                    )}
                  </dd>
                </div>
              </dl>

              <p className={styles.muted}>
                {r.fee_included_in_reserved_amount
                  ? "کارمزد در مبلغ رزرو لحاظ شده است."
                  : "کارمزد به مبلغ رزرو اضافه نمی‌شود."}
              </p>

              <div
                className={`vaka-panel ${styles.total}`}
              >
                <div>
                  <b>
                    مبلغ نهایی جهت بلوکه در صندوق امانی
                  </b>

                  <p className={styles.muted}>
                    مبلغ از پاسخ پیش‌نمایش رزرو دریافت شده
                    است.
                  </p>
                </div>

                <strong>
                  {money(
                    r.reserved_amount,
                    r.currency_code
                  )}
                </strong>
              </div>

              <div className={styles.row}>
                <p className={styles.muted}>
                  موجودی قابل برداشت کیف پول:{" "}
                  <b>
                    {money(
                      w.available_balance,
                      w.currency_code
                    )}
                  </b>
                </p>

                <span
                  className={`${styles.badge} ${
                    !preview.can_confirm
                      ? styles.warning
                      : ""
                  }`}
                >
                  {w.has_sufficient_balance &&
                  w.currency_matches
                    ? "موجودی کافی است"
                    : "موجودی یا ارز نامعتبر است"}
                </span>
              </div>

              {w.shortfall_amount > 0 && (
                <p className={styles.error}>
                  کسری موجودی:{" "}
                  {money(
                    w.shortfall_amount,
                    r.currency_code
                  )}
                  {" — "}
                  <Link href="/profile/wallet">
                    افزایش موجودی
                  </Link>
                </p>
              )}

              {preview.blocking_reason && (
                <p className={styles.error}>
                  {preview.blocking_reason}
                </p>
              )}
            </Card>

            {/* Workflow features */}

            <div className={styles.features}>
              <div
                className={`vaka-card ${styles.feature}`}
              >
                <b>♙ بلوکه شدن وجه</b>

                <p>
                  رزرو با تأیید سرور و بررسی موجودی انجام
                  می‌شود.
                </p>
              </div>

              <div
                className={`vaka-card ${styles.feature}`}
              >
                <b>▤ فاکتور خرید</b>

                <p>
                  {preview.task.receipt_required
                    ? "ارائه فاکتور برای این مأموریت الزامی است."
                    : "فاکتور مطابق شرایط تسک بررسی می‌شود."}
                </p>
              </div>

              <div
                className={`vaka-card ${styles.feature}`}
              >
                <b>✓ پیگیری مأموریت</b>

                <p>
                  وضعیت اجرا و گزارش‌های مجری در تسک‌های من
                  قابل مشاهده است.
                </p>
              </div>
            </div>

            {/* Confirmation buttons */}

            <Card>
              <div className={styles.actions}>
                <button
                  className="vaka-primary-button"
                  type="button"
                  disabled={
                    !preview.can_confirm ||
                    busy ||
                    !!result
                  }
                  onClick={() => void confirm()}
                >
                  تأیید و رزرو وجه امانی ←
                </button>

                <Link
                  href={back}
                  className="vaka-secondary-button"
                >
                  انصراف و بازگشت به لیست پیشنهادها
                </Link>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Reservation dialog */}

      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="assignment-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
        }}
      >
        {busy ? (
          <>
            <span
              className={styles.dialogIcon}
              aria-hidden="true"
            >
              ♙
            </span>

            <h2 id="assignment-dialog-title">
              در حال پردازش و رزرو امانت...
            </h2>

            <p role="status">
              در حال دریافت نتیجه از صندوق امانی واکا.
            </p>

            <div
              className={styles.loader}
              role="progressbar"
              aria-label="در حال رزرو"
            />
          </>
        ) : result ? (
          <>
            <span
              className={styles.dialogIcon}
              aria-hidden="true"
            >
              ✓
            </span>

            {result.escrow_public_reference && (
              <span className={styles.badge}>
                کد پیگیری امانت:{" "}
                <bdi>
                  {result.escrow_public_reference}
                </bdi>
              </span>
            )}

            <h2 id="assignment-dialog-title">
              پذیرش پیشنهاد و رزرو وجه انجام شد!
            </h2>

            <p>
              مبلغ{" "}
              {money(
                result.reserved_amount,
                result.currency_code
              )}
              {" برای "}
              {result.executor_name}
              {" رزرو شد."}
            </p>

            <div
              className={`vaka-panel ${styles.card}`}
            >
              <dl className={styles.amounts}>
                <div>
                  <dt>عنوان تسک</dt>
                  <dd>{result.task_title}</dd>
                </div>

                <div>
                  <dt>وضعیت رزرو</dt>

                  <dd>
                    {result.escrow_status === "HELD"
                      ? "بلوکه شده"
                      : result.escrow_status}
                  </dd>
                </div>

                <div>
                  <dt>
                    مانده قابل برداشت کیف پول
                  </dt>

                  <dd>
                    {money(
                      result.available_balance_after_reservation,
                      result.currency_code
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className={styles.actions}>
              <Link
                className="vaka-primary-button"
                href={trackingPath(taskId)}
              >
                مشاهده روند مأموریت
              </Link>

              <Link
                className="vaka-secondary-button"
                href="/employer/tasks"
              >
                بازگشت به تسک‌های من
              </Link>
            </div>
          </>
        ) : null}
      </dialog>
    </DashboardLayout>
  );
}

export default function AssignmentPage() {
  return (
    <Suspense
      fallback={
        <div role="status">
          در حال بارگذاری اطلاعات رزرو...
        </div>
      }
    >
      <AssignmentContent />
    </Suspense>
  );
}