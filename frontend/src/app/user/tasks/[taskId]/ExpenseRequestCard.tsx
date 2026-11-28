import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { toEnglishDigits } from "@/components/profile-verification/utils/number-utils";
import { TaskIcon, taskDate, taskNumber } from "../TaskVisuals";
import taskStyles from "../tasks.module.css";
import { createExpenseClaim, getExpenseClaims, type ExpenseClaim } from "./expense-claims";
import styles from "./ExpenseRequestCard.module.css";

const receiptTypes = ["image/jpeg", "image/png", "image/webp"];
const maxReceipts = 3;
const maxReceiptBytes = 5 * 1024 * 1024;
const maxDescription = 2000;

const claimStatus = {
  PENDING: "در انتظار بررسی",
  APPROVED: "بازپرداخت شد",
  REJECTED: "رد شد",
};

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3Zm3 5h8m-8 4h8m-8 4h4" />
    </svg>
  );
}

export default function ExpenseRequestCard({ taskId, canRequest }: { taskId: string; canRequest: boolean }) {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const dialogTitle = useId();
  const cardTitle = useId();
  const receiptHint = useId();
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getExpenseClaims(taskId, controller.signal).then(result => {
      if (!controller.signal.aborted) setClaims(result);
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "دریافت درخواست‌های هزینه ناموفق بود.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [taskId, revision]);

  function reload() {
    setLoadError("");
    setLoading(true);
    setRevision(value => value + 1);
  }

  function openDialog() {
    setNotice("");
    dialog.current?.showModal();
    titleInput.current?.focus();
  }

  function closeDialog() {
    if (!submitting.current) dialog.current?.close();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRequest || submitting.current) return;

    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    const details = String(data.get("details") ?? "").trim();
    const description = `${title} — ${details}`;
    const amountToman = toEnglishDigits(String(data.get("amount") ?? "")).trim().replace(/[٬,\s]/g, "");

    if (!/^\d{1,18}$/.test(amountToman)) {
      setSubmitError("مبلغ درخواست را به تومان و به‌صورت عدد صحیح وارد کنید.");
      return;
    }
    const amountIrr = BigInt(amountToman) * BigInt(10);
    if (amountIrr < BigInt(1) || amountIrr > BigInt("9223372036854775807")) {
      setSubmitError("مبلغ درخواست را در محدودهٔ معتبر وارد کنید.");
      return;
    }
    if (!title || !details || description.length > maxDescription) {
      setSubmitError("عنوان و توضیحات را وارد کنید. متن درخواست حداکثر ۲۰۰۰ نویسه باشد.");
      return;
    }
    if (files.length < 1 || files.length > maxReceipts) {
      setSubmitError("بین یک تا سه تصویر فاکتور انتخاب کنید.");
      return;
    }
    if (files.some(file => !receiptTypes.includes(file.type) || file.size < 1 || file.size > maxReceiptBytes)) {
      setSubmitError("تصاویر فاکتور باید JPG، PNG یا WebP و حداکثر ۵ مگابایت باشند.");
      return;
    }

    submitting.current = true;
    setSending(true);
    setSubmitError("");
    try {
      const created = await createExpenseClaim(taskId, String(amountIrr), description, files);
      setClaims(current => [created, ...current.filter(claim => claim.claim_id !== created.claim_id)]);
      dialog.current?.close();
      setNotice("درخواست هزینه و فاکتور برای بررسی کارفرما ارسال شد.");
      reload();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "ارسال درخواست ناموفق بود.");
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  const pendingCount = claims.filter(claim => claim.status === "PENDING").length;

  return (
    <section className={`${taskStyles.card} ${styles.card}`} aria-labelledby={cardTitle}>
      <header className={styles.header}>
        <span className={styles.icon}><ReceiptIcon /></span>
        <h2 id={cardTitle}>درخواست آزادسازی هزینه و فاکتور</h2>
        {(pendingCount > 0 || (!loading && !loadError)) && (
          <span className={styles.status} data-status={pendingCount ? "PENDING" : undefined}>
            {pendingCount ? `${taskNumber(pendingCount)} در انتظار بررسی` : "بدون درخواست معلق"}
          </span>
        )}
      </header>
      <p className={styles.intro}>فاکتور خرید را برای بازپرداخت از سقف هزینهٔ رزروشده برای کارفرما بفرستید.</p>
      <div className={styles.actions}>
        {canRequest && (
          <button className="vaka-primary-button" ref={opener} type="button" onClick={openDialog}>
            <TaskIcon name="upload" /> ثبت درخواست هزینه
          </button>
        )}
        <button className="vaka-secondary-button" type="button" disabled={loading} onClick={reload}>به‌روزرسانی درخواست‌ها</button>
      </div>
      {!canRequest && <p className={styles.helper}>ثبت درخواست برای کارهایی با وجه رزروشدهٔ ریالی در دسترس است.</p>}
      {notice && <p className={taskStyles.notice} role="status">{notice}</p>}
      {loadError && <p className={taskStyles.error} role="alert">{loadError}</p>}
      {!claims.length && !loadError && <p className={styles.empty} role="status">{loading ? "در حال دریافت درخواست‌ها..." : "هنوز درخواست هزینه‌ای ثبت نشده است."}</p>}
      {claims.map(claim => (
        <article key={claim.claim_id} className={styles.claim}>
          <div className={styles.claimHeader}>
            <strong>{taskNumber(claim.amount_irr / 10)} تومان</strong>
            <span className={styles.status} data-status={claim.status}>{claimStatus[claim.status]}</span>
          </div>
          <p className={styles.claimDescription}>{claim.description}</p>
          {claim.rejection_reason && <p className={styles.rejection}>دلیل رد: {claim.rejection_reason}</p>}
          <div className={styles.claimMeta}>
            <span><ReceiptIcon /> {taskNumber(claim.receipts.length)} فاکتور</span>
            <time dateTime={claim.created_at}>{taskDate(claim.created_at)}</time>
          </div>
        </article>
      ))}

      <dialog
        ref={dialog}
        className={`${taskStyles.modal} ${taskStyles.progressModal} ${styles.dialog}`}
        aria-labelledby={dialogTitle}
        onCancel={event => { if (submitting.current) event.preventDefault(); }}
        onClose={() => {
          dialog.current?.querySelector("form")?.reset();
          setFiles([]);
          setSubmitError("");
          opener.current?.focus();
        }}
      >
        <form onSubmit={event => void submit(event)}>
          <button className={taskStyles.close} aria-label="بستن" type="button" onClick={closeDialog} disabled={sending}>
            <TaskIcon name="close" />
          </button>
          <h2 id={dialogTitle}>ثبت درخواست آزادسازی هزینه</h2>
          <p className={taskStyles.progressIntro}>مبلغ خرید و تصویر فاکتور را برای بررسی کارفرما ارسال کنید.</p>
          <fieldset className={styles.fields} disabled={sending}>
            <div className={styles.fieldsRow}>
              <label>عنوان درخواست
                <input name="title" ref={titleInput} placeholder="مثلاً خرید لوازم بسته‌بندی" required maxLength={maxDescription} />
              </label>
              <label>مبلغ درخواستی (تومان)
                <input name="amount" inputMode="numeric" placeholder="مثلاً ۲۵۰٬۰۰۰" required />
              </label>
            </div>
            <label>توضیحات هزینه
              <textarea name="details" placeholder="شرح کوتاهی از خرید و دلیل هزینه بنویسید…" required maxLength={maxDescription} />
            </label>
            <label className={styles.upload}>
              <span className={styles.uploadIcon}><TaskIcon name="upload" /></span>
              <span>
                <strong>{files.length ? `${taskNumber(files.length)} تصویر فاکتور انتخاب شد` : "انتخاب تصویر فاکتور"}</strong>
                <small id={receiptHint}>۱ تا ۳ تصویر JPG، PNG یا WebP، حداکثر ۵ مگابایت برای هر تصویر</small>
              </span>
              <input type="file" aria-label="انتخاب تصویر فاکتور" aria-describedby={receiptHint} accept={receiptTypes.join(",")} multiple required onChange={event => setFiles(Array.from(event.currentTarget.files ?? []))} />
            </label>
            {files.length > 0 && (
              <ul className={styles.files} aria-label="تصاویر انتخاب‌شده">
                {files.map((file, index) => <li key={index}><bdi>{file.name}</bdi></li>)}
              </ul>
            )}
          </fieldset>
          {submitError && <p className={taskStyles.error} role="alert">{submitError}</p>}
          <div className={taskStyles.reportActions}>
            <button type="submit" disabled={sending}><TaskIcon name="send" /> {sending ? "در حال ارسال..." : "ثبت و ارسال درخواست"}</button>
            <button type="button" onClick={closeDialog} disabled={sending}>انصراف</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
