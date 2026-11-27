import type { ReactNode } from "react";
import Link from "next/link";
import { avatars } from "@/lib/profile-avatars";
import styles from "./Workflow.module.css";

export const number = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
export function money(amount: number, currency: string) {
  return `${number(currency === "IRR" ? amount / 10 : amount)} ${currency === "IRR" ? "تومان" : currency}`;
}
export function date(value?: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("fa-IR", {dateStyle: "medium", timeStyle: "short"}).format(new Date(value)) : "—";
}
export function duration(minutes: number) {
  const hours = Math.floor(minutes / 60); const remainder = minutes % 60;
  return [hours ? `${number(hours)} ساعت` : "", remainder ? `${number(remainder)} دقیقه` : ""].filter(Boolean).join(" و ") || "—";
}
export const statusLabels: Record<string, string> = {ASSIGNED: "در انتظار شروع مجری", IN_PROGRESS: "در حال انجام توسط مجری", SUBMITTED: "تحویل شده، در انتظار بررسی", APPROVED: "تأیید شده", COMPLETED: "تکمیل شده", DISPUTED: "دارای اختلاف", CANCELLATION_REVIEW: "در حال بررسی لغو", CANCELLED: "لغو شده"};
export function Steps({stage}: {stage: 2 | 3}) {
  return <div className={styles.steps} aria-label="مراحل تسک">{["ثبت تسک", "تأیید و رزرو وجه", "اجرای مأموریت"].map((label, index) => <span key={label} className={`${styles.step} ${index + 1 <= stage ? styles.current : ""}`}><b>{index + 1 < stage ? "✓" : number(index + 1)}</b>{label}{index < 2 && <i className={styles.line}/>}</span>)}</div>;
}
export function Card({children, className = ""}: {children: ReactNode; className?: string}) {
  return <section className={`vaka-card ${styles.card} ${className}`}>{children}</section>;
}
export function Worker({id, name, avatarId, avatarUrl, bio, verified, rating, completed}: {id: string; name: string; avatarId?: string | null; avatarUrl?: string | null; bio?: string | null; verified?: boolean; rating?: number | string | null; completed?: number | string | null}) {
  const preset = avatars.find(item => item.id.replace("avatar-0", "avatar_") === avatarId);
  const src = avatarUrl || preset?.src;
  return <><div className={styles.person}>{src ? (
    // Uploaded avatars use backend-provided URLs, matching ProfileSidebar.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.avatar} src={src} alt=""/>) : <div className={`${styles.avatar} ${styles.avatarFallback}`}>{name?.trim().charAt(0) || "م"}</div>}<div><h3>{name || "مجری"}</h3>{verified && <span className={styles.badge}>احراز هویت شده</span>}</div></div><p className={styles.muted}>{rating != null ? `★ ${number(Number(rating))}` : "امتیاز ثبت نشده"}{completed != null && ` | ${number(Number(completed))} کار تکمیل شده`}</p>{bio && <p className={styles.muted}>{bio}</p>}<Link className="vaka-secondary-button" href={`/worker/${encodeURIComponent(id)}`}>مشاهده پروفایل مجری</Link></>;
}

export function WorkflowIcon({name}: {name: "timer" | "check" | "play" | "report" | "wallet" | "phone" | "lock" | "receipt"}) {
  const paths: Record<typeof name, ReactNode> = {
    timer: <><circle cx="12" cy="14" r="8"/><path d="M9 2h6M12 6V2m0 8v4m6-7 2-2"/></>,
    check: <path d="m5 12 4 4L19 6"/>, play: <path d="m9 5 11 7-11 7Z"/>,
    report: <><path d="M6 3h9l4 4v14H6zM15 3v5h4M9 14h7m-7 3h5"/></>,
    wallet: <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h1m10 0h1"/></>,
    phone: <path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c0 2-2 2-3 2C9 20 4 15 3 6c0-2 0-3 2-3Z"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>,
    receipt: <><path d="M5 3l3 2 4-2 4 2 3-2v18l-3-2-4 2-4-2-3 2zM8 9h8m-8 4h8m-8 4h5"/></>,
  };
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function Timeline({status, assignedAt, startedAt, hasReport, deliveryAt}: {status: string; assignedAt?: string|null; startedAt?: string|null; hasReport: boolean; deliveryAt?: string|null}) {
  const completed = status === "COMPLETED";
  const delivered = ["SUBMITTED", "APPROVED", "COMPLETED"].includes(status) || !!deliveryAt;
  const started = !!startedAt || status === "IN_PROGRESS" || delivered;
  const interrupted = ["DISPUTED", "CANCELLATION_REVIEW", "CANCELLED"].includes(status);
  const stage = completed || delivered ? 4 : started && hasReport ? 3 : 2;
  const steps = [
    {title: "تخصیص مجری و توافق", subtitle: assignedAt ? date(assignedAt) : "رزرو وجه و تخصیص انجام شد", done: true, icon: "check" as const},
    {title: "شروع رسمی کار", subtitle: startedAt ? date(startedAt) : started ? "کار آغاز شده است" : "در انتظار شروع مجری", done: started && (hasReport || delivered), icon: "play" as const},
    {title: "ثبت گزارش پیشرفت", subtitle: delivered ? "تحویل ثبت شده" : "مرحله میانی", done: delivered, icon: "report" as const},
    {title: "تحویل نهایی و آزادسازی وجه", subtitle: completed ? "تسک تکمیل شده" : deliveryAt ? date(deliveryAt) : "مرحله پایانی و تسویه حساب", done: completed, icon: "wallet" as const},
  ];
  return <Card className={styles.timelineCard}><div className={styles.row}><h2>مراحل انجام کار</h2><span className={styles.stageCount}>{interrupted ? statusLabels[status] : `گام ${number(stage)} از ۴`}</span></div><ol className={styles.timeline}>{steps.map((step,i)=>{
    const current = !interrupted && !step.done && i===stage-1;
    return <li key={step.title} className={step.done ? styles.timelineDone : current ? styles.timelineActive : styles.timelineWaiting}><b><WorkflowIcon name={step.done ? "check" : step.icon}/></b><div><strong>{step.title}</strong><small>{step.subtitle}</small></div>{current && <span className={styles.badge}>{started || i!==1 ? "فعال" : "در انتظار"}</span>}</li>;
  })}</ol></Card>;
}
