"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import {Card,statusLabels} from "@/components/employer-workflow/shared";
import {listExecutorTasks,type ExecutorTaskCard} from "@/lib/executor-api";
export default function Page(){
 const [items,setItems]=useState<ExecutorTaskCard[]|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();listExecutorTasks(c.signal).then(v=>{if(!c.signal.aborted)setItems(v);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:"دریافت تسک ناموفق بود");});return()=>c.abort();},[retry]);
 return <DashboardLayout title="مأموریت‌های من" description="تسک‌های واگذار شده" variant="workflow"><Card><button onClick={()=>{setError("");setRetry(n=>n+1);}}>به‌روزرسانی</button>{error&&<p role="alert">{error}</p>}{!items&&!error&&<p>در حال دریافت...</p>}{items?.length===0&&<p>تسکی واگذار نشده است.</p>}{items?.map(t=><p key={t.task_id}><Link href={`/worker/tasks/${encodeURIComponent(t.task_id)}`}>{t.title} — {statusLabels[t.status]||t.status}</Link></p>)}</Card></DashboardLayout>;
}
