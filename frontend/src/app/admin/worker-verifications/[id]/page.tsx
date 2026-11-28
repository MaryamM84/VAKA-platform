"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ADMIN_PATH, getApplication, getDocument, decideApplication, type VerificationDetail } from "@/lib/admin-api";
import type { VerificationDocument } from "@/lib/verification-api";
import { Avatar, Status, date, errorText } from "@/components/admin/shared";
import styles from "@/components/admin/Admin.module.css";

function DocumentCard({ id, document }: { id: string; document: VerificationDocument }) {
  const [image, setImage] = useState(""); const [error,setError] = useState(""); const [retry,setRetry] = useState(0); const dialog = useRef<HTMLDialogElement>(null);
  const title = document.document_type === "NATIONAL_CARD_FRONT" ? "روی کارت ملی" : document.document_type === "NATIONAL_CARD_BACK" ? "پشت کارت ملی" : document.original_file_name;
  useEffect(()=>{ const controller = new AbortController(); let url = ""; getDocument(id,document.document_id,controller.signal).then(blob=>{if (!controller.signal.aborted) {url=URL.createObjectURL(blob);setImage(url);}}).catch(e=>{if(!controller.signal.aborted)setError(errorText(e));});return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};},[id,document.document_id,retry]);
  return <div className={`vaka-panel ${styles.document}`}>
    {/* Private images use an authenticated blob URL, never the public Next image optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {image ? <img src={image} alt={title}/> : <div className={styles.documentPlaceholder}>{error || "در حال دریافت تصویر..."}{error && <button onClick={()=>{setError("");setRetry(n=>n+1);}}>تلاش مجدد</button>}</div>}
    <b>{title}</b><button disabled={!image} onClick={()=>dialog.current?.showModal()}>◉ مشاهده مدرک</button>
    <dialog ref={dialog} className={styles.preview}><button className={styles.close} aria-label="بستن" onClick={()=>dialog.current?.close()}>×</button><h2>{title}</h2>{/* eslint-disable-next-line @next/next/no-img-element */}{image && <img src={image} alt={title}/>}</dialog>
  </div>;
}
export default function Page() {
  const { id } = useParams<{id:string}>();
  return <Detail key={id} id={id}/>;
}
function Detail({id}:{id:string}) {
  const [data,setData] = useState<VerificationDetail|null>(null); const [error,setError]=useState(""); const [retry,setRetry]=useState(0); const [reason,setReason]=useState(""); const [action,setAction]=useState<"approve"|"reject">("approve"); const [busy,setBusy]=useState(false); const [decisionError,setDecisionError]=useState(""); const [notice,setNotice]=useState(""); const modal=useRef<HTMLDialogElement>(null);
  useEffect(()=>{let active=true;getApplication(id).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(errorText(e));});return()=>{active=false;};},[id,retry]);
  async function submit(){if(busy || !data || data.verification_status!=="PENDING")return;setBusy(true);setDecisionError("");try{const updated=await decideApplication(id,action,reason);setData(updated);modal.current?.close();setNotice(action==="approve"?"درخواست تأیید شد.":"درخواست رد شد.");}catch(e){setDecisionError(errorText(e));}finally{setBusy(false);}}
  function confirm(next:"approve"|"reject"){setDecisionError("");if(next==="reject"&&!reason.trim()){setNotice("برای رد درخواست، دلیل را وارد کنید.");return;}setNotice("");setAction(next);modal.current?.showModal();}
  return <main className={`${styles.page} ${styles.detailPage}`}><div className={styles.container}>
    <div className={styles.detailHeading}><h1>جزئیات درخواست احراز هویت</h1><Link className="vaka-secondary-button" href={ADMIN_PATH}>بازگشت به لیست</Link></div>
    {error ? <div className="vaka-card p-6" role="alert">{error} <button onClick={()=>{setError("");setRetry(n=>n+1);}}>تلاش مجدد</button></div> : !data ? <p role="status">در حال دریافت اطلاعات...</p> : <>
    <section className={`vaka-card ${styles.summary}`}><div className={styles.person}><Avatar name={data.applicant.full_name}/><div><h2>{data.applicant.full_name || "بدون نام"}</h2><small dir="ltr">{data.applicant.phone}</small></div></div><div><small>شناسه درخواست</small><b className={styles.identifier} dir="ltr">{id}</b></div><div><Status status={data.verification_status}/><small>تاریخ ارسال درخواست: {date(data.application_submitted_at)}</small></div></section>
    <div className={styles.detailGrid}><section className={`vaka-card ${styles.section}`}><h2>♙ اطلاعات پروفایل مجری</h2><dl>{[["نام و نام خانوادگی",data.applicant.full_name],["نام کاربری",null],["شماره تماس",data.applicant.phone],["ایمیل",data.applicant.email],["تاریخ عضویت",null]].map(([label,value])=><div key={label}><dt>{label}</dt><dd dir="auto">{value || "—"}</dd></div>)}</dl></section>
    <section className={`vaka-card ${styles.section}`}><h2>▧ مدارک آپلودشده</h2><div className={styles.documents}>{data.documents.length?data.documents.map(d=><DocumentCard key={d.document_id} id={id} document={d}/>):<p>مدرکی ثبت نشده است.</p>}</div></section></div>
    <section className={`vaka-card ${styles.decision}`}>
      {data.verification_status === "PENDING" ? <><div className={styles.decisionButtons}><button className={styles.dangerOutline} onClick={()=>confirm("reject")}>× رد درخواست</button><button className="vaka-primary-button" onClick={()=>confirm("approve")}>✓ تأیید درخواست</button></div><label>دلیل رد درخواست (برای رد الزامی است)<textarea value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)} placeholder="لطفاً دلیل رد درخواست را وارد کنید..."/></label></> : <p>این درخواست {data.verification_status === "APPROVED" ? "تأیید" : "بررسی"} شده است. {data.rejection_reason && `دلیل رد: ${data.rejection_reason}`}</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
    </section>
    <dialog ref={modal} className={styles.modal} onCancel={e=>{if(busy)e.preventDefault();}}><button className={styles.close} disabled={busy} onClick={()=>modal.current?.close()} aria-label="بستن">×</button><div className={`${styles.decisionIcon} ${action==="reject"?styles.rejectIcon:""}`}>{action==="approve"?"✓":"×"}</div><h2>درخواست احراز هویت {action==="approve"?"تأیید":"رد"} شود؟</h2><p>{action==="approve"?"با تأیید این درخواست، دسترسی مجری به امکانات مربوط به کاربران تأییدشده فعال می‌شود.":"با رد این درخواست، احراز هویت مجری تأیید نخواهد شد."}</p><div className={`vaka-panel ${styles.modalPerson}`}><b>{data.applicant.full_name}</b><small dir="ltr">{id}</small></div>{decisionError&&<p role="alert">{decisionError}</p>}<div className={styles.modalActions}><button disabled={busy} className={action==="reject"?styles.dangerButton:"vaka-primary-button"} onClick={submit}>{busy?"در حال ثبت...":action==="approve"?"✓ تأیید درخواست":"× ثبت رد درخواست"}</button><button disabled={busy} className="vaka-secondary-button" onClick={()=>modal.current?.close()}>انصراف</button></div></dialog>
    </>}
  </div></main>;
}
