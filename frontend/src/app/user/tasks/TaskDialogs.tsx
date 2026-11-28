"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { AssignedTask } from "@/lib/assigned-tasks";
import { TaskIcon, taskDuration, taskNumber } from "./TaskVisuals";
import styles from "./tasks.module.css";

type Props = {
  task: AssignedTask; kind: "start" | "progress"; busy: boolean; error: string;
  percent: number; description: string; onSchedule: boolean;
  onPercent: (value: number) => void; onDescription: (value: string) => void;
  onScheduleChange: (value: boolean) => void; onClose: () => void; onSubmit: () => void;
};

export default function TaskDialogs(props: Props) {
  const { task, kind, busy, error, percent, description, onSchedule, onClose, onSubmit } = props;
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const currency = task.currency === "IRR" ? "ریال" : task.currency;
  return createPortal(<div className={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className={`${styles.modal} ${kind === "start" ? styles.startModal : styles.progressModal}`} ref={dialog} role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" tabIndex={-1} dir="rtl" onKeyDown={event => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),input:not(:disabled),a[href]');
        if (!items?.length) { event.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
      }
    }}>
      <button className={styles.close} aria-label="بستن" disabled={busy} onClick={onClose}><TaskIcon name="close"/></button>
      {kind === "start" ? <>
        <div className={styles.rocket}><TaskIcon name="rocket"/></div>
        <h2 id="task-dialog-title">آیا از شروع رسمی انجام کار اطمینان دارید؟</h2>
        <p className={styles.modalIntro}>با تأیید شروع، زمان‌سنج مهلت تحویل ({taskDuration(task.duration_minutes)}) فعال شده، وضعیت کار به «در حال انجام» تغییر یافته و اطلاعات محرمانه پروژه برای شما بازگشایی می‌گردد.</p>
        <div className={styles.startSummary}>
          <div><span>{task.secured_amount != null ? "مبلغ سپرده امانی تضمین‌شده:" : "مبلغ توافق‌شده:"}</span><b className={styles.summaryMoney}>{taskNumber(task.secured_amount ?? task.wage)} <small>{currency}</small></b></div>
          <div><span>کارفرما:</span><b>{task.employer_name || "کارفرما"}{task.employer_verified && <TaskIcon name="check"/>}</b></div>
          <div><span>مهلت تحویل تعهدشده:</span><b>{taskDuration(task.duration_minutes)} (شروع از لحظه تأیید)</b></div>
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.startActions}><button onClick={onClose} disabled={busy}>انصراف</button><button onClick={onSubmit} disabled={busy || !task.can_start}><TaskIcon name="check"/>بله، کار را آغاز می‌کنم</button></div>
        <p className={styles.startFootnote}><TaskIcon name="shield"/>پرداخت از طریق سیستم حساب امانی واکا</p>
      </> : <>
        <h2 id="task-dialog-title">ثبت وضعیت پیشرفت کار</h2><p className={styles.progressIntro}>گزارش مختصر از روند اجرای کار به کارفرما</p>
        <div className={styles.progressStatus}><span><TaskIcon name="check"/>کار فعال: اجرای تعهدات پروژه</span><b>● در حال انجام</b></div>
        <div className={styles.progressLabel}><span><TaskIcon name="gauge"/>میزان پیشرفت کار</span><b>{taskNumber(percent)}٪</b></div>
        <progress className={styles.progressBar} max="100" value={percent} aria-label="میزان پیشرفت کار"/>
        <div className={styles.percent}>{[25,50,75,100].map(value => <button key={value} disabled={busy || value < task.progress_percent} aria-pressed={value === percent} className={value === percent ? styles.selected : ""} onClick={() => props.onPercent(value)}>{taskNumber(value)}٪</button>)}</div>
        <label className={styles.reportLabel} htmlFor="task-report">توضیحات و گزارش انجام کار <span>*</span></label>
        <textarea id="task-report" maxLength={4000} required disabled={busy} value={description} onChange={event => props.onDescription(event.target.value)} placeholder="شرح مختصری از اقدامات انجام‌شده، وضعیت فعلی و گام‌های بعدی بنویسید..."/>
        <label className={styles.check}><input type="checkbox" disabled={busy} checked={onSchedule} onChange={event => props.onScheduleChange(event.target.checked)}/>کار مطابق با زمان‌بندی توافقی در حال انجام است</label>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.reportActions}><button disabled={busy || !description.trim() || !task.can_report_progress} onClick={onSubmit}><TaskIcon name="send"/>ثبت و ارسال گزارش</button><button disabled={busy} onClick={onClose}>انصراف</button></div>
      </>}
    </div>
  </div>, document.body);
}
