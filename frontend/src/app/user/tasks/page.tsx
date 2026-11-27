"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import UserPanelLayout from "@/components/user-panel/UserPanelLayout";
import { getAssignedTasks, type AssignedTask } from "@/lib/assigned-tasks";
import styles from "./tasks.module.css";

export default function TasksPage() {
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { getAssignedTasks().then(setTasks).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }, []);
  return <UserPanelLayout profileName="" completion={0} activePage="tasks" taskMenuLabel="کارهای من"><section className={styles.list}>
    <h1>کار های برای انجام من ✦</h1><p>کارهایی که به شما تخصیص یافته و برای انجام دارید.</p><h2>کارهای تخصیص یافته</h2>
    {loading ? <p>در حال دریافت کارها...</p> : error ? <p role="alert">{error}</p> : tasks.length === 0 ? <p>کار تخصیص‌یافته‌ای ندارید.</p> : tasks.map(task => <Link className={styles.taskLink} key={task.task_id} href={`/user/tasks/${task.task_id}`}><strong>{task.title}</strong><span>{task.status === "ASSIGNED" ? "آماده شروع کار" : "در حال انجام"} ←</span></Link>)}
  </section></UserPanelLayout>;
}
