"use client";

import { useEffect, useState } from "react";
import styles from "./tasks.module.css";
import { TaskIcon } from "./TaskVisuals";
import { taskCountdown, taskRemainingSeconds, type TaskTimerInput } from "@/lib/task-timer";

export default function DeadlineTimer({ deadline, startedAt, remainingSeconds, durationMinutes, serverTime, measuredAt }: TaskTimerInput & { measuredAt: number }) {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    const initial = taskRemainingSeconds({ deadline, startedAt, remainingSeconds, durationMinutes, serverTime });
    const update = () => {
      setValue(initial === null ? null : taskCountdown(initial, performance.now() - measuredAt));
    };
    const first = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => { window.clearTimeout(first); window.clearInterval(interval); };
  }, [deadline, startedAt, remainingSeconds, durationMinutes, serverTime, measuredAt]);
  return <div className={styles.timer}><span className={styles.timerIcon}><TaskIcon name="timer"/></span><div className={styles.timerText}><small>زمان‌سنج مهلت تحویل کار</small><div className={styles.timerValue}><strong dir="ltr" role="timer" aria-label="زمان باقی‌مانده">{value ?? "—"}</strong><small>{value === "۰۰:۰۰:۰۰" ? "مهلت تحویل پایان یافته است" : "فرصت باقی‌مانده تا تحویل نهایی"}</small></div></div></div>;
}
