"use client";
import { Suspense, use, useEffect, useState } from "react";
import UserPanelLayout from "@/components/user-panel/UserPanelLayout";
import { getAssignedTask, reportProgress, startTask, type AssignedTask } from "@/lib/assigned-tasks";
import styles from "../tasks.module.css";
import TaskMap from "../TaskMap";
import DeadlineTimer from "../DeadlineTimer";

const number = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
export default function AssignedTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  return <Suspense fallback={<p>در حال دریافت تسک...</p>}><TaskDetails params={params} /></Suspense>;
}

function TaskDetails({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  const [task, setTask] = useState<AssignedTask | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"start" | "progress" | null>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(50);
  const [description, setDescription] = useState("");
  const [onSchedule, setOnSchedule] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    getAssignedTask(taskId).then(setTask).catch((e: Error) => setError(e.message));
  }, [taskId]);
  const active = task?.status === "IN_PROGRESS";
  async function submit() {
    setBusy(true); setError("");
    try { if (modal === "start") setTask(await startTask(taskId)); else { await reportProgress(taskId, percent, description, onSchedule); setNotice("گزارش پیشرفت ثبت شد."); } setDescription(""); setModal(null); }
    catch (e) { setError(e instanceof Error ? e.message : "خطایی رخ داد."); } finally { setBusy(false); }
  }
  return <UserPanelLayout profileName="" completion={0} activePage="tasks"><div className={styles.detail}>
    <header><h1>تسک‌های من ✦</h1><p>کارهایی که به شما تخصیص یافته و برای انجام دارید.</p></header>
    <div className={styles.steps}>● ثبت تسک ━━━ ● تایید و واریز وجه ━━━ {active ? "●" : "۳"} اجرای ماموریت</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
    {!task ? !error && <p>در حال دریافت تسک...</p> : <div className={styles.layout}>
      <main>
        {active && <div className={styles.banner}><DeadlineTimer deadline={task.deadline_at} startedAt={task.started_at}/><button onClick={() => setModal("progress")}>ثبت گزارش پیشرفت کار</button></div>}
        <section className={styles.card}><div className={styles.badge}>{active ? "در حال انجام" : "آماده شروع کار"}</div><h2>{task.title}</h2><p>{task.category}</p><div className={styles.facts}><span>مبلغ توافق‌شده <b>{number(task.wage)} {task.currency === "IRR" ? "ریال" : task.currency}</b></span><span>تخصیص‌یافته به شما ✓</span><span>مدت توافق‌شده {number(task.duration_minutes)} دقیقه</span></div></section>
        {active && <section className={`${styles.card} ${styles.private}`}><h3>♧ اطلاعات محرمانه و دسترسی‌های مستقیم کارفرما</h3><div className={styles.info}><b>شماره تماس مستقیم کارفرما</b><p>جهت هماهنگی با کارفرما</p>{task.employer_phone ? <a dir="ltr" href={`tel:${task.employer_phone}`}>{task.employer_phone}</a> : <span>شماره تماس در دسترس نیست.</span>}</div><div className={styles.location}><b>⌖ موقعیت مکانی</b>{task.locations?.length ? task.locations.map((location, index) => <div key={index}><p>{[location.city, location.region, location.address].filter(Boolean).join("، ")}</p>{typeof location.latitude === "number" && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 && typeof location.longitude === "number" && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180 ? <TaskMap latitude={location.latitude} longitude={location.longitude}/> : <p>مختصات موقعیت در دسترس نیست.</p>}</div>) : <p>موقعیتی ثبت نشده است.</p>}</div></section>}
        <section className={styles.card}><h3>☰ توضیحات و الزامات {active ? "تحویل کار" : "کار"}</h3><p className={styles.description}>{task.description}</p><div className={styles.info}><b>الزامات تحویل</b><p>{task.delivery_criteria || "موردی ثبت نشده است."}</p></div></section>
        {!active && <section className={`${styles.card} ${styles.start}`}><h3>اقدام به شروع پروژه</h3><p>با آغاز کار، وضعیت تسک تغییر می‌کند و اطلاعات تماس کارفرما نمایش داده می‌شود.</p><button onClick={() => setModal("start")}>▶ شروع کار (Start Work)</button></section>}
      </main>
      <aside><section className={`${styles.card} ${styles.employer}`}><div className={styles.avatar}>{task.employer_avatar_url ? <img src={task.employer_avatar_url} alt="" /> : <span aria-hidden="true">♙</span>}</div><h3>{task.employer_name || "کارفرما"}</h3><div className={styles.employerBadges}><span>کارفرما</span>{task.employer_verified && <span>کارفرمای تأیید شده ✓</span>}</div><div className={styles.employerStats}><div><b>{task.employer_rating != null ? `${number(task.employer_rating)} ★` : "—"}</b><small>امتیاز کاربران</small></div><div><b>{task.employer_completed_tasks != null ? `${number(task.employer_completed_tasks)} تسک` : "—"}</b><small>انجام موفق</small></div></div><div className={styles.employerActions}>{task.employer_profile_url && <a href={task.employer_profile_url}>پروفایل کارفرما</a>}{task.conversation_url && <a href={task.conversation_url}>گفتگوی آنلاین</a>}</div></section><section className={styles.card}><h3>مراحل انجام کار</h3><p>✅ تخصیص مجری و توافق</p><p>{active ? "✅" : "🟠"} شروع رسمی کار توسط شما</p><p>◯ ارسال پیش‌نمایش و بازخورد</p><p>◯ تحویل نهایی و آزادسازی وجه</p></section><section className={`${styles.card} ${styles.guarantee}`}><h3>◈ ضمانت پرداخت امن واکا</h3>{task.escrow_status === "FUNDED" ? <><p>مبلغ توافق‌شده در حساب امانی نگهداری می‌شود.</p><ul><li>وجه پیش از شروع کار تأمین شده است</li><li>تسویه پس از تحویل نهایی انجام می‌شود</li></ul></> : <p>وضعیت پرداخت امانی {task.escrow_status === "PENDING" ? "در انتظار تأمین وجه است." : "در دسترس نیست."}</p>}</section></aside>
    </div>}
    {modal && task && <div className={styles.overlay} onClick={() => !busy && setModal(null)}><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}><button className={styles.close} aria-label="بستن" onClick={() => setModal(null)}>×</button>
      {modal === "start" ? <><div className={styles.rocket}>🚀</div><h2 id="modal-title">آیا از شروع رسمی انجام تسک اطمینان دارید؟</h2><p>با تایید شروع، وضعیت تسک به «در حال انجام» تغییر یافته و اطلاعات کارفرما برای شما بازگشایی می‌گردد.</p><div className={styles.info}><p>مبلغ توافق‌شده: <b>{number(task.wage)} {task.currency === "IRR" ? "ریال" : task.currency}</b></p><p>کارفرما: {task.employer_name}</p><p>مدت توافق‌شده: {number(task.duration_minutes)} دقیقه</p></div><div className={styles.actions}><button onClick={submit} disabled={busy}>بله، کار را آغاز می‌کنم ✓</button><button onClick={() => setModal(null)}>انصراف</button></div></> : <><h2 id="modal-title">ثبت وضعیت پیشرفت کار</h2><p>گزارش مختصر از روند اجرای کار به کارفرما</p><div className={styles.info}>تسک فعال: اجرای تعهدات پروژه <span>● در حال انجام</span></div><h4>میزان پیشرفت کار <span>{number(percent)}٪</span></h4><progress max="100" value={percent}/><div className={styles.percent}>{[25,50,75,100].map(n => <button key={n} className={n === percent ? styles.selected : ""} onClick={() => setPercent(n)}>{number(n)}٪</button>)}</div><label>توضیحات و گزارش انجام کار *<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="شرح مختصری از اقدامات انجام‌شده، وضعیت فعلی و گام‌های بعدی بنویسید..." /></label><label className={styles.check}><input type="checkbox" checked={onSchedule} onChange={e => setOnSchedule(e.target.checked)}/> کار مطابق با زمان‌بندی توافقی در حال انجام است</label><div className={styles.actions}><button onClick={submit} disabled={busy || !description.trim()}>ثبت و ارسال گزارش ◁</button><button onClick={() => setModal(null)}>انصراف</button></div></>}
    </div></div>}
  </div></UserPanelLayout>;
}
