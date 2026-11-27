"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import ExpenseClaims from "@/components/employer-workflow/ExpenseClaims";
import {Card,statusLabels} from "@/components/employer-workflow/shared";
import {apiRequest} from "@/lib/task-api";
import styles from "@/components/employer-workflow/Workflow.module.css";
export default function WorkerExpensePage(){
  const {taskId}=useParams<{taskId:string}>();
  const [task,setTask]=useState<{title:string;status:string}|null>(null);const [error,setError]=useState("");
  useEffect(()=>{const c=new AbortController();let live=true;async function load(){try{const data=await apiRequest<{title:string;status:string}>(`/api/executor/tasks/${encodeURIComponent(taskId)}/`,{signal:c.signal});if(live){setTask(data);setError("");}}catch(e){if(live){setTask(null);setError(e instanceof Error?e.message:"دریافت تسک ناموفق بود.");}}}void load();const timer=window.setInterval(()=>void load(),30000);return()=>{live=false;c.abort();window.clearInterval(timer);};},[taskId]);
  return <DashboardLayout title="هزینه‌های مأموریت" description="ثبت فاکتور و پیگیری بازپرداخت هزینه" variant="workflow"><div className={styles.stack}><Card><Link className="vaka-secondary-button" href="/worker/bids">بازگشت به پیشنهادهای من</Link>{task&&<><h2>{task.title}</h2><span className={styles.badge}>{statusLabels[task.status]||task.status}</span></>}{error&&<p className={styles.error} role="alert">{error}</p>}</Card>{task&&<ExpenseClaims key={taskId} taskId={taskId} mode="worker" canSubmit={["ASSIGNED","IN_PROGRESS"].includes(task.status)}/>}</div></DashboardLayout>;
}
