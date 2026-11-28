"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ADMIN_PATH, listAllApplications, type VerificationApplication } from "@/lib/admin-api";
import { Avatar, Status, date, number, errorText } from "@/components/admin/shared";
import styles from "@/components/admin/Admin.module.css";
const PAGE_SIZE = 4;
export default function Page() {
  const [items, setItems] = useState<VerificationApplication[] | null>(null);
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("ALL"); const [newest, setNewest] = useState(true); const [page, setPage] = useState(1);
  useEffect(() => { const controller = new AbortController(); let active = true; listAllApplications(controller.signal).then(data => { if (active) setItems(data); }).catch(e => { if (active) setError(errorText(e)); }); return () => { active = false; controller.abort(); }; }, [retry]);
  const normalize = (s: string) => s.toLowerCase().replace(/ي/g,"ی").replace(/ك/g,"ک").trim();
  const filtered = (items ?? []).filter(a => (filter === "ALL" || a.verification_status === filter) && normalize(`${a.applicant.full_name} ${a.executor_profile_id}`).includes(normalize(query))).sort((a,b) => (newest ? -1 : 1) * ((Date.parse(a.application_submitted_at ?? "") || 0) - (Date.parse(b.application_submitted_at ?? "") || 0)));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); const current = Math.min(page,pages); const start = (current - 1)*PAGE_SIZE;
  return <main className={`${styles.page} ${styles.listPage}`}><div className={styles.container}>
    <div className={styles.overview}><div><h1>بررسی درخواست‌ها</h1><p>بررسی و مدیریت درخواست‌های احراز هویت</p></div><div className={styles.stats}>
      {[{ label:"همه درخواست‌های دریافتی", count:items?.length, icon:"▤" },{label:"در انتظار بررسی",count:items?.filter(a=>a.verification_status==="PENDING").length,icon:"◷"},{label:"تأیید شده",count:items?.filter(a=>a.verification_status==="APPROVED").length,icon:"✓"}].map(s=><div key={s.label} className={styles.stat}><span className={styles.statIcon}>{s.icon}</span><div><strong>{s.count === undefined ? "—" : number(s.count)}</strong><small>{s.label}</small></div></div>)}
    </div></div>
    <section className={`vaka-card ${styles.tableCard}`}><div className={styles.toolbar}><input aria-label="جستجوی درخواست" type="search" placeholder="جستجوی نام یا شناسه درخواست..." value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/><div className={styles.filters}>{[["ALL","همه درخواست‌ها"],["PENDING","در انتظار بررسی"],["APPROVED","تأیید شده"],["REJECTED","رد شده"]].map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>{setFilter(value);setPage(1);}}>{label}</button>)}</div><select aria-label="ترتیب نمایش" value={newest?"new":"old"} onChange={e=>{setNewest(e.target.value==="new");setPage(1);}}><option value="new">جدیدترین ابتدا</option><option value="old">قدیمی‌ترین ابتدا</option></select></div>
    {error ? <p role="alert" className={styles.message}>{error} <button onClick={()=>{setError("");setItems(null);setRetry(n=>n+1);}}>تلاش مجدد</button></p> : !items ? <p role="status" className={styles.message}>در حال دریافت درخواست‌ها...</p> : <><div className={styles.tableScroll}><table><thead><tr><th>مجری</th><th>شناسه درخواست</th><th>تاریخ ارسال</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{filtered.slice(start,start+PAGE_SIZE).map(a=><tr key={a.executor_profile_id}><td><div className={styles.person}><Avatar name={a.applicant.full_name}/><b>{a.applicant.full_name || "بدون نام"}</b></div></td><td><span dir="ltr" title={a.executor_profile_id}>{a.executor_profile_id.slice(0,8)}…</span></td><td>{date(a.application_submitted_at)}</td><td><Status status={a.verification_status}/></td><td><Link className={styles.outline} href={`${ADMIN_PATH}/${a.executor_profile_id}`}>◉ مشاهده جزئیات</Link></td></tr>)}</tbody></table></div>{!filtered.length && <p className={styles.message}>درخواستی یافت نشد.</p>}<footer className={styles.pagination}><div><button disabled={current===1} onClick={()=>setPage(current-1)} aria-label="صفحه قبل">‹</button><span>{number(current)}</span><button disabled={current===pages} onClick={()=>setPage(current+1)} aria-label="صفحه بعد">›</button></div><small>نمایش {number(filtered.length?start+1:0)} تا {number(Math.min(start+PAGE_SIZE,filtered.length))} از {number(filtered.length)} درخواست</small></footer></>}
    </section>
  </div></main>;
}
