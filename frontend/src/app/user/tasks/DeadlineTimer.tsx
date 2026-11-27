"use client";

import { useEffect, useState } from "react";
import styles from "./tasks.module.css";
import { TaskIcon } from "./TaskVisuals";

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

export default function DeadlineTimer({ deadline, startedAt, remainingSeconds }: { deadline: string | null; startedAt: string | null; remainingSeconds: number | null }) {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    const initial = typeof remainingSeconds === "number" && Number.isFinite(remainingSeconds) && remainingSeconds >= 0 ? Math.min(MAX_DURATION_SECONDS, remainingSeconds) : null;
    const measuredAt = performance.now();
    const update = () => {
      if (initial === null) { setValue(deadline ? remaining(deadline, startedAt) : null); return; }
      const seconds = Math.max(0, Math.floor(initial - (performance.now() - measuredAt) / 1000));
      setValue([Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
        .map(part => String(part).padStart(2, "0")).join(":").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]));
    };
    const first = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [deadline, startedAt, remainingSeconds]);
  return <div className={styles.timer}><span className={styles.timerIcon}><TaskIcon name="timer"/></span><div className={styles.timerText}><small>زمان‌سنج مهلت تحویل کار</small><div className={styles.timerValue}><strong dir="ltr" role="timer" aria-label="زمان باقی‌مانده">{value ?? "—"}</strong><small>{value === "۰۰:۰۰:۰۰" ? "مهلت تحویل پایان یافته است" : "فرصت باقی‌مانده تا تحویل نهایی"}</small></div></div></div>;
}
