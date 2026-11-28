"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {listExecutors,type AdminExecutor} from "@/lib/admin-api";
import {errorText,date,number,Status} from "@/components/admin/shared";
import styles from "@/components/admin/Admin.module.css";
export default function Page(){
  const [items,setItems]=useState<AdminExecutor[]|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0),[query,setQuery]=useState("");
  useEffect(()=>{const c=new AbortController();listExecutors(c.signal).then(v=>{if(!c.signal.aborted)setItems(v);}).catch(e=>{if(!c.signal.aborted)setError(errorText(e));});return()=>c.abort();},[retry]);
  const rows=items?.filter(v=>`${v.full_name} ${v.phone} ${v.service_area_city}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className={styles.page}><div className={styles.container}><h1>مجریان تأیید شده</h1><section className={`vaka-card ${styles.tableCard}`}><div className={styles.toolbar}><input aria-label="جستجوی مجری" value={query} onChange={e=>setQuery(e.target.value)} placeholder="نام، تلفن یا شهر"/><button onClick={()=>{setError("");setItems(null);setRetry(n=>n+1);}}>به‌روزرسانی</button></div>{error?<p role="alert">{error}</p>:!rows?<p role="status">در حال دریافت...</p>:<div className={styles.tableScroll}><table><thead><tr><th>نام</th><th>تلفن</th><th>شهر</th><th>وضعیت</th><th>فعال / تکمیل شده</th><th>تاریخ تأیید</th><th>جزئیات</th></tr></thead><tbody>{rows.map(v=><tr key={v.executor_profile_id}><td>{v.full_name}</td><td dir="ltr">{v.phone}</td><td>{v.service_area_city}</td><td><Status status={v.verification_status}/></td><td>{number(v.active_tasks_count)} / {number(v.completed_tasks_count)}</td><td>{date(v.approved_at)}</td><td><Link href={`/admin/worker-verifications/${encodeURIComponent(v.executor_profile_id)}`}>مشاهده</Link></td></tr>)}</tbody></table>{!rows.length&&<p>مجری یافت نشد.</p>}</div>}</section></div></main>;
}
