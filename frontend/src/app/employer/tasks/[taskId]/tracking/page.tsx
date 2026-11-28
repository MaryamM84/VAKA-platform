"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import { getEmployerTasks, getTaskBids, getAssignedExecutor, getEmployerReports, type AssignedExecutor, type ProgressReport, type EmployerTaskApi, type EmployerBidListApi } from "@/lib/employer-api";
import { Card, Steps, Worker, Timeline, WorkflowIcon, date, money, number, duration, statusLabels } from "@/components/employer-workflow/shared";
import ExpenseClaims from "@/components/employer-workflow/ExpenseClaims";
import styles from "@/components/employer-workflow/Workflow.module.css";

type Snapshot = {task: EmployerTaskApi; bid: EmployerBidListApi; worker: AssignedExecutor | null; reports: ProgressReport[] | null; trackingError: string; contactError: string};

function remainingTime(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
  return [h,m,s].map(v => new Intl.NumberFormat("fa-IR",{minimumIntegerDigits:2,useGrouping:false}).format(v)).join(":");
}
function TrackingContent() {
  const {taskId} = useParams<{taskId: string}>();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true; let running = false;
    const controller = new AbortController();
    async function load(initial = false) {
      if (running) return; running = true;
      if (initial) { setLoading(true); setSnapshot(null); setError(""); }
      try {
        const [tasks,bids] = await Promise.all([getEmployerTasks(), getTaskBids(taskId)]);
        const task = tasks.find(t => t.task_id === taskId);
        const bid = bids.find(b => b.status === "ACCEPTED" && b.task_id === taskId);
        if (!task || !bid) throw new Error("تسک یا پیشنهاد پذیرفته‌شده پیدا نشد.");
        const [workerResult, reportResult] = await Promise.allSettled([getAssignedExecutor(taskId,controller.signal), getEmployerReports(taskId,controller.signal)]);
        if (!live) return;
        const failure = (result: PromiseSettledResult<unknown>) => result.status === "rejected" ? result.reason instanceof Error ? result.reason.message : "دریافت اطلاعات ناموفق بود." : "";
        const worker = workerResult.status === "fulfilled" ? workerResult.value : null;
        setSnapshot({task,bid,worker,reports: reportResult.status === "fulfilled" ? reportResult.value : null,trackingError:failure(reportResult),contactError:failure(workerResult)}); setNow(Date.now()); setError("");
      } catch (err) { if (live) { setSnapshot(null); setError(err instanceof Error ? err.message : "دریافت تسک ممکن نشد."); } }
      finally {running = false; if (live) setLoading(false);}
    }
    void load(true);
    const poll = window.setInterval(() => void load(), 30000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {live = false; controller.abort(); window.clearInterval(poll); window.clearInterval(tick);};
  }, [taskId,refresh]);
  const t = snapshot?.task, b = snapshot?.bid, w = snapshot?.worker, reports = snapshot?.reports;
  const status = w?.task_status || t?.status || "";
  const due = t?.deadline_at || t?.execution_window_end_at;
  const serverNow = now; // employer API does not expose server time
  const phone = w?.can_view_phone ? w.phone : null;
  const progress = reports?.reduce((max, r) => Math.max(max, r.progress_percent), 0) ?? 0;
  const remaining = due && Number.isFinite(Date.parse(due)) ? Math.max(0, Math.floor((Date.parse(due)-serverNow)/1000)) : null;
  const active = status === "IN_PROGRESS";
  const submitted = ["SUBMITTED","APPROVED","COMPLETED"].includes(status);
  const finished = ["APPROVED","COMPLETED"].includes(status);
  return <DashboardLayout title="تسک‌های من" description="پیگیری مأموریت و وضعیت اجرای تسک" variant="workflow" workflowSteps={<Steps stage={3}/>}>
    <div className={styles.stack}>
      {loading && <Card><p role="status">در حال دریافت اطلاعات مأموریت...</p></Card>}
      {error && <Card><p className={styles.error} role="alert">{error}</p><div className={styles.actions}><button className="vaka-secondary-button" onClick={() => setRefresh(n => n+1)}>تلاش مجدد</button><Link className="vaka-secondary-button" href="/employer/tasks">بازگشت به کارهای من</Link></div></Card>}
      {snapshot && t && b && <div className={styles.trackingGrid}>
        <div className={styles.stack}>
          <Card className={styles.timer}><div className={styles.timerIcon}><WorkflowIcon name="timer"/></div><div className={styles.timerContent}><p className={styles.timerLabel}>زمان‌سنج مهلت تحویل تسک</p><div className={styles.timerValue}><strong dir="ltr">{active && remaining !== null ? remainingTime(remaining) : "—"}</strong><span>{active ? remaining === 0 ? "مهلت تحویل پایان یافت" : "فرصت باقی‌مانده تا تحویل نهایی" : statusLabels[status] || status}</span></div><small>{due ? `مهلت تحویل: ${date(due)}` : "مهلت تحویل مشخص نشده"}</small></div></Card>
          <Card><div className={styles.row}><span className={styles.badge}>{statusLabels[status] || status}</span><span className={styles.muted}>مدت پیشنهادی: {duration(b.proposed_duration_minutes)}</span></div><h2>{t.title}</h2><p className={styles.muted}>{t.description}</p><div className={`vaka-panel ${styles.total}`}><span>دستمزد توافق شده (نه موجودی صندوق)</span><strong>{money(b.proposed_wage_amount,t.currency_code || "IRR")}</strong></div><p className={styles.muted}>شرایط تحویل: {t.delivery_criteria}</p></Card>
          <Card className={styles.contactCard}><div className={styles.header}><h2 className={styles.iconHeading}><span><WorkflowIcon name="lock"/></span>اطلاعات محرمانه و دسترسی‌های مستقیم مجری</h2><span className={`${styles.badge} ${!phone ? styles.warning : styles.success}`}>{phone ? "فعال و معتبر" : "محدود"}</span></div><div className={`vaka-panel ${styles.contact}`}><b className={styles.iconHeading}><WorkflowIcon name="phone"/> شماره تماس مستقیم مجری</b>{phone ? <><p className={styles.muted}>جهت هماهنگی مستقیم در زمان اجرای کار</p><div className={styles.row}><a href={`tel:${phone}`} dir="ltr">{phone}</a><a className="vaka-primary-button" href={`tel:${phone}`}>تماس</a></div></> : <><p className={styles.muted}>{snapshot.contactError || (status === "ASSIGNED" ? "پس از شروع رسمی کار، شماره تماس فعال می‌شود." : "سرور مجوز یا شماره تماس مجری را برنگردانده است.")}</p>{snapshot.contactError && <button className="vaka-secondary-button" onClick={()=>setRefresh(n=>n+1)}>تلاش مجدد</button>}</>}</div></Card>
          <ExpenseClaims key={taskId} taskId={taskId} mode="employer"/>
          <Card><div className={styles.header}><h2>گزارش‌های زنده پیشرفت کار ثبت‌شده توسط مجری</h2><button className="vaka-secondary-button" type="button" onClick={() => setRefresh(n=>n+1)}>به‌روزرسانی</button></div>{snapshot.trackingError && <p className={styles.error} role="alert">{snapshot.trackingError}</p>}{reports ? <><div className={`vaka-panel ${styles.contact}`}><div className={styles.row}><b>پیشرفت کار</b><span>{number(progress)}٪</span></div><progress className={styles.progress} value={progress} max={100}/></div>{reports.length ? reports.map(report => <article key={report.report_id} className={`vaka-panel ${styles.report}`}><div className={styles.row}><b>گزارش پیشرفت {number(report.progress_percent)}٪</b><span className={styles.muted}>{date(report.created_at)}</span></div><p>{report.description}</p><span className={`${styles.badge} ${!report.on_schedule ? styles.warning : ""}`}>{report.on_schedule ? "طبق برنامه" : "خارج از برنامه"}</span></article>) : <p className={styles.muted}>هنوز گزارشی ثبت نشده است.</p>}</> : <p className={styles.muted}>گزارش واقعی از سرور دریافت نشده است.</p>}</Card>
          <Card><div className={styles.header}><h2>تأیید نهایی و تسویه امن پروژه</h2><span className={styles.badge}>{finished ? "تأیید شده" : submitted ? "تحویل شده" : "در انتظار تحویل"}</span></div><p className={styles.muted}>جزئیات مدرک تحویل و مبلغ رزرو در API کارفرما ارائه نشده است.</p><p className={styles.muted}>{finished ? "وضعیت تأیید یا تکمیل از سرور دریافت شده است." : "API تأیید تحویل و آزادسازی وجه هنوز در دسترس نیست؛ آزادسازی هزینه فاکتور در بخش درخواست هزینه جداگانه انجام می‌شود."}</p>{!finished && <button type="button" disabled className="vaka-primary-button">تأیید نهایی و آزادسازی وجه ✓</button>}</Card>
        </div>
        <aside className={styles.stack}>
          <Card><Worker id={b.executor_profile_id} name={w?.full_name || b.executor_name} avatarId={w?.avatar_id} avatarUrl={w?.avatar_url} verified={b.executor_verification_status === "APPROVED"} rating={w?.average_rating} completed={w?.completed_tasks_count}/></Card>
          <Timeline status={status} hasReport={!!reports?.length}/>
          <Link className="vaka-secondary-button" href="/employer/tasks">بازگشت به تسک‌های من</Link>
        </aside>
      </div>}
    </div>
  </DashboardLayout>;
}
export default function TrackingPage() {
  return (
    <Suspense fallback={<div>در حال بارگذاری...</div>}>
      <TrackingContent />
    </Suspense>
  );
}