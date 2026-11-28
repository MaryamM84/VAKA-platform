"use client";

import { useState } from "react";
import type { AssignedTask } from "@/lib/assigned-tasks";
import { TaskIcon, taskDate, taskNumber } from "./TaskVisuals";
import styles from "./tasks.module.css";

export default function TaskSideCards({ task }: { task: AssignedTask }) {
  const active = task.status === "IN_PROGRESS";
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  return <aside className={`${styles.taskAside} ${active ? styles.activeAside : ""}`} aria-label="کارفرما و مراحل انجام کار">
    <section className={`${styles.card} ${styles.employer}`}>
      <div className={styles.avatar}>
        {task.employer_avatar_url && failedAvatar !== task.employer_avatar_url
          // Uploaded employer images can be hosted on the configured API origin.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={task.employer_avatar_url} alt={`تصویر ${task.employer_name || "کارفرما"}`} onError={() => setFailedAvatar(task.employer_avatar_url ?? null)} />
          : <TaskIcon name="user" />}
        {task.employer_verified && <span className={styles.avatarCheck}><TaskIcon name="check" /></span>}
      </div>
      <h2>{task.employer_name || "کارفرما"}</h2>
      <div className={styles.employerBadges}><span>{task.employer_verified ? "کارفرما تأیید شده" : "کارفرما"}</span></div>
      <div className={styles.employerStats}>
        <div><small>{active ? "امتیاز کارفرمایی" : "امتیاز کاربران"}</small><b>{task.employer_rating != null ? <>{taskNumber(task.employer_rating)} <i>★</i></> : "—"}</b></div>
        <div><small>{active ? "کارهای انجام موفق" : "انجام موفق"}</small><b>{task.employer_completed_tasks != null ? `${taskNumber(task.employer_completed_tasks)} کار` : "—"}</b></div>
      </div>
      <div className={styles.employerActions}>
        {task.employer_profile_url ? <a href={task.employer_profile_url}><TaskIcon name="user"/>پروفایل کارفرما</a> : <button disabled title="لینک پروفایل کارفرما در دسترس نیست"><TaskIcon name="user"/>پروفایل کارفرما</button>}
        {task.conversation_url ? <a href={task.conversation_url}><TaskIcon name="chat"/>گفتگوی آنلاین</a> : <button disabled title="گفتگوی آنلاین در دسترس نیست"><TaskIcon name="chat"/>گفتگوی آنلاین</button>}
      </div>
    </section>
    <section className={`${styles.card} ${styles.timeline}`}>
      <h2>مراحل انجام کار {active && <small>گام ۲ از ۴</small>}</h2>
      <ol>
        <li className={styles.done}><span><TaskIcon name="check"/></span><div><b>تخصیص مجری و توافق</b><small>{taskDate(task.assigned_at) || "انجام شد"}{active && task.assigned_at ? " (انجام شد)" : ""}</small></div></li>
        <li className={styles.current}><span>{active ? <TaskIcon name="play"/> : <i/>}</span><div><b>شروع رسمی کار توسط شما</b><small>{active ? `شروع شده${task.started_at ? ` (${taskDate(task.started_at)})` : ""}` : "در انتظار تأیید شما"}</small></div>{active && <em>فعال</em>}</li>
        <li><span>{active ? <TaskIcon name="upload"/> : <i/>}</span><div><b>{active ? "ثبت گزارش پیشرفت" : "ارسال پیش‌نمایش و بازخورد"}</b><small>مرحله میانی</small></div></li>
        <li><span>{active ? <TaskIcon name="money"/> : <i/>}</span><div><b>تحویل نهایی و آزادسازی وجه</b><small>{active ? "مرحله پایانی و تسویه حساب" : "مرحله پایانی"}</small></div></li>
      </ol>
    </section>
    <section className={`${styles.card} ${styles.guarantee}`}>
      <div className={styles.guaranteeTitle}><span><TaskIcon name="shield"/></span><div><h2>ضمانت پرداخت امن واکا</h2>{active && task.escrow_status === "FUNDED" && <strong>وجه امانی تأیید شده در صندوق</strong>}</div></div>
      {task.escrow_status === "FUNDED" ? <>
        <p>دستمزد توافق شده شما تا پایان کار و تأیید نهایی توسط صندوق امن واکا نگهداری می‌شود. شما با آسودگی خاطر می‌توانید پروژه را {active ? "جلو ببرید." : "آغاز نمایید."}</p>
        <ul><li><TaskIcon name="check"/>واریز پیشاپیش وجه توسط کارفرما</li><li><TaskIcon name="check"/>پشتیبانی و داوری در صورت بروز اختلاف</li><li><TaskIcon name="check"/>تسویه آنی پس از تحویل نهایی فایل‌ها</li></ul>
      </> : <p>وضعیت پرداخت امانی {task.escrow_status === "PENDING" ? "در انتظار تأمین وجه است." : "در دسترس نیست."}</p>}
    </section>
  </aside>;
}
