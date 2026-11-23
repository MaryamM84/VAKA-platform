"use client";

import { useEffect, useState } from "react";
import styles from "./tasks.module.css";

const MAX_DURATION_SECONDS = 300 * 60;

function remaining(deadline: string, startedAt: string | null) {
  const end = Date.parse(deadline);
  if (!Number.isFinite(end)) return null;
  const start = startedAt ? Date.parse(startedAt) : NaN;
  if (!Number.isFinite(start) && end - Date.now() > MAX_DURATION_SECONDS * 1000) return null;
  const cappedEnd = Number.isFinite(start) ? Math.min(end, start + MAX_DURATION_SECONDS * 1000) : end;
  const seconds = Math.min(MAX_DURATION_SECONDS, Math.max(0, Math.floor((cappedEnd - Date.now()) / 1000)));
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map(part => String(part).padStart(2, "0")).join(":").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

export default function DeadlineTimer({ deadline, startedAt }: { deadline: string | null; startedAt: string | null }) {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    if (!deadline) return;
    const update = () => setValue(remaining(deadline, startedAt));
    const first = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [deadline, startedAt]);
  return <div className={styles.timer}><span>◷</span><div><small>زمان‌سنج مهلت تحویل تسک</small><strong dir="ltr">{value ?? "زمان معتبر در دسترس نیست"}</strong><small>{value === "۰۰:۰۰:۰۰" ? "مهلت تحویل پایان یافته است" : "زمان باقی‌مانده تا تحویل نهایی"}</small></div></div>;
}
