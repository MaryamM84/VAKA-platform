"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import ProfileSidebar from "@/components/layout/profile/ProfileSidebar";
import { addPrivateDetails, getAssignedTask, getPrivateDetails, reportProgress, startTask, type AssignedTask } from "@/lib/assigned-tasks";
import TaskMap from "../TaskMap";
import DeadlineTimer from "../DeadlineTimer";
import TaskSideCards from "../TaskSideCards";
import TaskDialogs from "../TaskDialogs";
import { TaskIcon, taskDuration, taskNumber } from "../TaskVisuals";
import styles from "../tasks.module.css";

export default function AssignedTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  return <Suspense fallback={<p>در حال دریافت کار...</p>}><TaskRoute params={params}/></Suspense>;
}

function TaskRoute({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  return <TaskDetails key={taskId} taskId={taskId}/>;
}

function TaskDetails({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<AssignedTask | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"start" | "progress" | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [percent, setPercent] = useState(50);
  const [description, setDescription] = useState("");
  const [onSchedule, setOnSchedule] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let result = await getAssignedTask(taskId);
        if (result.status !== "ASSIGNED" && result.status !== "IN_PROGRESS") throw new Error("این کار در مرحله قابل نمایش این صفحه نیست.");
        if (result.can_view_private_details && result.status === "IN_PROGRESS") {
          try { result = addPrivateDetails(result, await getPrivateDetails(taskId)); }
          catch { if (!cancelled) setError("دریافت اطلاعات محرمانه ناموفق بود. برای تلاش مجدد صفحه را بازخوانی کنید."); }
        }
        if (!cancelled) { setTask(result); setPercent(Math.max(50, result.progress_percent)); }
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : "دریافت کار ناموفق بود."); }
    })();
    return () => { cancelled = true; };
  }, [taskId]);

  async function submit() {
    if (!task || !modal || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    try {
      if (modal === "start") {
        if (!task.can_start) throw new Error("شروع این کار در وضعیت فعلی امکان‌پذیر نیست.");
        await startTask(taskId);
        setModal(null);
        try {
          let updated = await getAssignedTask(taskId);
          if (updated.can_view_private_details && updated.status === "IN_PROGRESS") {
            try { updated = addPrivateDetails(updated, await getPrivateDetails(taskId)); }
            catch { setError("کار شروع شد، اما دریافت اطلاعات محرمانه ناموفق بود. صفحه را بازخوانی کنید."); }
          }
          setTask(updated);
        } catch { setTask(null); setError("کار شروع شد، اما دریافت وضعیت جدید ناموفق بود. صفحه را بازخوانی کنید."); }
      } else {
        if (!task.can_report_progress || percent < task.progress_percent) throw new Error("درصد گزارش نمی‌تواند کمتر از پیشرفت ثبت‌شده باشد.");
        await reportProgress(taskId, percent, description, onSchedule);
        setTask(current => current ? { ...current, progress_percent: percent } : current);
        setNotice("گزارش پیشرفت ثبت شد."); setDescription(""); setModal(null);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "خطایی رخ داد."); }
    finally { submitting.current = false; setBusy(false); }
  }

  const active = task?.status === "IN_PROGRESS";
  function openModal(kind: "start" | "progress") { setError(""); setNotice(""); setModal(kind); }
  return <div className={styles.workspace} dir="rtl">
    <div className={styles.workspaceInner}>
      <div className={styles.workspaceHeader}>
      <header className={styles.pageHeading}><h1>کار های برای انجام من <span>✦</span></h1><p>کارهایی که به شما تخصیص یافته و برای انجام دارید.</p></header>
      <nav className={styles.steps} aria-label="مراحل واگذاری کار">
        <span><i><TaskIcon name="check"/></i>ثبت کار</span><b/>
        <span><i>{active ? <TaskIcon name="check"/> : "۲"}</i>تأیید و رزرو وجه</span><b className={!active ? styles.pendingLine : ""}/>
        <span className={!active ? styles.pendingStep : ""}><i>{active ? <TaskIcon name="check"/> : "۳"}</i>اجرای مأموریت</span>
      </nav>
      </div>
      <div className={styles.workspaceGrid}>
        <div className={styles.userSidebar}><ProfileSidebar /></div>
        <main className={styles.taskContent}>
          {error && !modal && <p role="alert" className={styles.error}>{error}</p>}
          {notice && <p role="status" className={styles.notice}>{notice}</p>}
          {!task ? !error && <p>در حال دریافت کار...</p> : <>
            {active && <div className={styles.banner}><DeadlineTimer deadline={task.deadline_at} startedAt={task.started_at} remainingSeconds={task.remaining_seconds} durationMinutes={task.duration_minutes} serverTime={task.server_time}/><button onClick={() => openModal("progress")} disabled={!task.can_report_progress}><TaskIcon name="gauge"/>ثبت گزارش پیشرفت کار</button></div>}
            <div className={`${styles.layout} ${active ? styles.activeLayout : ""}`}>
              <div className={styles.mainColumn}>
                <section className={`${styles.card} ${styles.taskSummary}`}>
                  <div className={styles.summaryMeta}><span className={styles.badge}><i/>{active ? "در حال انجام" : "آماده شروع کار"}</span>{!active && <small className={styles.taskCode}>کد کار: <bdi>{task.task_id}</bdi></small>}<span className={styles.duration}><TaskIcon name="clock"/>مهلت تحویل: {taskDuration(task.duration_minutes)}</span></div>
                  <div className={styles.summaryBody}><div><h2>{task.title}</h2><p>دسته‌بندی: {task.category}</p></div><div className={styles.wage}><span>مبلغ توافق‌شده ({task.net_worker_amount != null ? active ? "خالص مجری" : "خالص" : "قرارداد"})</span><strong>{taskNumber(task.net_worker_amount ?? task.wage)} <small>{task.currency === "IRR" ? "ریال" : task.currency}</small></strong></div></div>
                  <div className={styles.facts}>
                    <div><span className={styles.factIcon}><TaskIcon name="check"/></span><div><small>وضعیت تخصیص مجری</small><b>تخصیص‌یافته به شما {!active && <bdi>(Assigned)</bdi>}</b></div></div>
                    <div className={task.escrow_status === "FUNDED" ? styles.funded : ""}><div><small>{active ? "ضمانت مالی واکا" : "وضعیت رزرو وجه"}</small><b>{task.escrow_status === "FUNDED" ? active ? "وجه امانی تأیید شد" : "وجه در صندوق واکا امن است" : "وضعیت وجه در دسترس نیست"}</b></div><span className={styles.factIcon}><TaskIcon name="shield"/></span>{!active && task.escrow_status === "FUNDED" && <em>تأیید شد</em>}</div>
                  </div>
                </section>
                {active && <section className={`${styles.card} ${styles.private}`}>
                  <div className={styles.sectionTitle}><span className={styles.privateIcon}><TaskIcon name="lock"/></span><h2>اطلاعات محرمانه و دسترسی‌های مستقیم کارفرما</h2><small>فعال و معتبر</small></div>
                  <div className={styles.phoneBox}><h3><TaskIcon name="phone"/>شماره تماس مستقیم کارفرما</h3><div className={styles.phoneRow}>{task.employer_phone ? <><a className={styles.callButton} href={`tel:${task.employer_phone}`} aria-label="تماس با کارفرما"><TaskIcon name="phone"/>تماس</a><a dir="ltr" href={`tel:${task.employer_phone}`}>{task.employer_phone}</a></> : <><button className={styles.callButton} disabled><TaskIcon name="phone"/>تماس</button><span>شماره تماس در دسترس نیست.</span></>}</div></div>
                  <div className={styles.location}><h3><TaskIcon name="pin"/>موقعیت مکانی</h3>{task.locations.length ? task.locations.map((location, index) => <div key={index}><p>{[location.city, location.region, location.address].filter(Boolean).join("، ")}</p>{typeof location.latitude === "number" && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 && typeof location.longitude === "number" && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180 ? <TaskMap latitude={location.latitude} longitude={location.longitude} label={location.notes}/> : <p>مختصات موقعیت در دسترس نیست.</p>}</div>) : <p>موقعیتی ثبت نشده است.</p>}</div>
                </section>}
                <section className={`${styles.card} ${styles.requirements}`}>
                  <div className={styles.sectionTitle}><TaskIcon name={active ? "checklist" : "list"}/><h2>توضیحات و الزامات {active ? "تحویل کار" : "کار"}</h2>{active && task.requirements.length > 0 && <small>{taskNumber(task.requirements.length)} گام کلیدی تعریف شده</small>}</div>
                  <p className={styles.description}>{task.description}</p>
                  <div className={styles.requirementGrid}>{task.requirements.map((requirement, index) => <div key={index}><TaskIcon name="check"/><div><b>{requirement.title}</b>{requirement.description && <p>{requirement.description}</p>}</div></div>)}</div>
                </section>
                {!active && <section className={`${styles.card} ${styles.start}`}><h2>اقدام به شروع پروژه</h2><p>با آغاز کار، شمارش معکوس زمان تحویل برای شما فعال شده و به کارفرما اطلاع‌رسانی می‌شود.</p><button onClick={() => openModal("start")} disabled={!task.can_start}>شروع کار <bdi>(Start Work)</bdi><TaskIcon name="play"/></button></section>}
              </div>
              <TaskSideCards task={task}/>
            </div>
          </>}
        </main>
      </div>
    </div>
    {modal && task && <TaskDialogs task={task} kind={modal} busy={busy} error={error} percent={percent} description={description} onSchedule={onSchedule} onPercent={setPercent} onDescription={setDescription} onScheduleChange={setOnSchedule} onClose={() => { if (!busy) setModal(null); }} onSubmit={() => void submit()}/>}
  </div>;
}
