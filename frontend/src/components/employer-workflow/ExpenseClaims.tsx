"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createExpenseClaim, decideExpenseClaim, getExpenseClaims, getExpenseReceipt, type ExpenseClaim } from "@/lib/expense-api";
import { Card, WorkflowIcon, date, money, number } from "./shared";
import styles from "./Workflow.module.css";

export default function ExpenseClaims({taskId,mode,canSubmit=true}: {taskId:string;mode:"employer"|"worker";canSubmit?:boolean}) {
  const [claims,setClaims] = useState<ExpenseClaim[]|null>(null);
  const [loadError,setLoadError] = useState("");
  const [actionError,setActionError] = useState("");
  const [revision,setRevision] = useState(0);
  const [busy,setBusy] = useState(false);
  const [amount,setAmount] = useState("");
  const [description,setDescription] = useState("");
  const [files,setFiles] = useState<File[]>([]);
  const [preview,setPreview] = useState<string|null>(null);
  const [decision,setDecision] = useState<{claim:ExpenseClaim;kind:"approve"|"reject"}|null>(null);
  const [reason,setReason] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  useEffect(()=>{
    const controller = new AbortController(); let live = true; let running = false;
    async function load(){ if(running)return; running=true;try {const data=await getExpenseClaims(taskId,controller.signal);if(live){setClaims(data);setLoadError("");}}catch(e){if(live)setLoadError(e instanceof Error?e.message:"دریافت درخواست هزینه ناموفق بود.");}finally{running=false;} }
    void load(); const timer=window.setInterval(()=>void load(),30000);
    return()=>{live=false;controller.abort();window.clearInterval(timer);};
  },[taskId,revision]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  function reload(){setRevision(n=>n+1);}
  async function run(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setActionError("");try{await action();reload();}catch(e){setActionError(e instanceof Error?e.message:"عملیات ناموفق بود.");reload();}finally{lock.current=false;setBusy(false);}}
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const irr=Number(amount)*10;if(!Number.isSafeInteger(irr)||irr<=0||!description.trim()||files.length<1||files.length>3){setActionError("مبلغ معتبر، توضیح و یک تا سه تصویر فاکتور الزامی است.");return;}void run(async()=>{await createExpenseClaim(taskId,irr,description.trim(),files);setAmount("");setDescription("");setFiles([]);if(input.current)input.current.value="";});}
  const pending=claims?.filter(c=>c.status==="PENDING").length;
  return <Card><div className={styles.header}><h2 className={styles.iconHeading}><span><WorkflowIcon name="receipt"/></span>درخواست آزادسازی هزینه و فاکتور</h2>{pending!==undefined&&<span className={`${styles.badge} ${pending?styles.warning:styles.success}`}>{pending?`${number(pending)} در انتظار بررسی`:"بدون درخواست معلق"}</span>}</div>
    <p className={styles.muted}>بازپرداخت هزینه خرید از سقف هزینه رزرو شده؛ جدا از دستمزد و تسویه نهایی.</p>
    {loadError&&<p role="alert" className={styles.error}>{loadError}</p>}{actionError&&<p role="alert" className={styles.error}>{actionError}</p>}
    <button type="button" className="vaka-secondary-button" disabled={busy} onClick={reload}>به‌روزرسانی درخواست‌ها</button>
    {!claims&&!loadError&&<p role="status">در حال دریافت درخواست‌ها...</p>}{claims?.length===0&&!loadError&&<p className={`vaka-panel ${styles.contact}`}>هنوز درخواست هزینه‌ای ثبت نشده است.</p>}
    {claims?.map(c=><article key={c.claim_id} className={`vaka-panel ${styles.report}`}><div className={styles.row}><strong>{money(c.amount_irr,c.currency_code)}</strong><span className={`${styles.badge} ${c.status==="PENDING"?styles.warning:c.status==="APPROVED"?styles.success:styles.danger}`}>{c.status==="PENDING"?"در انتظار بررسی":c.status==="APPROVED"?"تأیید و بازپرداخت شده":"رد شده"}</span></div><p>{c.description}</p><p className={styles.muted}>{date(c.created_at)}</p>{c.rejection_reason&&<p>دلیل رد: {c.rejection_reason}</p>}<div className={styles.actions}>{c.receipts.map((r,i)=><button type="button" key={r.receipt_id} disabled={busy} className="vaka-secondary-button" onClick={()=>void run(async()=>{const blob=await getExpenseReceipt(taskId,c.claim_id,r.receipt_id);if(!/^image\/(jpeg|png|webp)$/.test(blob.type))throw new Error("فرمت تصویر فاکتور معتبر نیست.");setPreview(URL.createObjectURL(blob));})}>مشاهده فاکتور {number(i+1)}</button>)}</div>{mode==="employer"&&c.status==="PENDING"&&<div className={styles.actions}><button type="button" className="vaka-primary-button" disabled={busy||!!loadError} onClick={()=>{setReason("");setDecision({claim:c,kind:"approve"});}}>تأیید هزینه و بازپرداخت</button><button type="button" className="vaka-secondary-button" disabled={busy||!!loadError} onClick={()=>{setReason("");setDecision({claim:c,kind:"reject"});}}>رد درخواست</button></div>}</article>)}
    {mode==="worker"&&canSubmit&&<form className={styles.claimForm} onSubmit={submit}><label>مبلغ درخواست (تومان)<input type="number" min="1" step="1" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>توضیح هزینه<textarea required maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>تصاویر فاکتور (۱ تا ۳ فایل)<input ref={input} type="file" required accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))}/></label><button type="submit" disabled={busy||!!loadError||!claims} className="vaka-primary-button">{busy?"در حال ارسال...":"ارسال درخواست آزادسازی هزینه"}</button></form>}
    {mode==="worker"&&!canSubmit&&<p className={styles.muted}>درخواست جدید فقط در وضعیت مجاز اجرای تسک ثبت می‌شود.</p>}
    {preview&&<div className={`vaka-panel ${styles.contact}`}><div className={styles.row}><b>تصویر خصوصی فاکتور</b><button type="button" className="vaka-secondary-button" onClick={()=>setPreview(null)}>بستن</button></div>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={preview} alt="تصویر فاکتور" className={styles.claimImage}/></div>}
    {decision&&<form className={`vaka-panel ${styles.contact} ${styles.claimForm}`} onSubmit={e=>{e.preventDefault();const d=decision;void run(async()=>{await decideExpenseClaim(taskId,d.claim.claim_id,d.kind,reason.trim());setDecision(null);});}}><strong>{decision.kind==="approve"?"تأیید بازپرداخت واقعی هزینه":"رد درخواست هزینه"} — {money(decision.claim.amount_irr,decision.claim.currency_code)}</strong>{decision.kind==="approve"?<p>با تأیید، مبلغ از وجه رزرو شده به کیف پول مجری منتقل می‌شود.</p>:<label>دلیل رد<textarea required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}<div className={styles.actions}><button type="submit" className="vaka-primary-button" disabled={busy||(decision.kind==="reject"&&!reason.trim())}>ثبت نهایی</button><button type="button" className="vaka-secondary-button" disabled={busy} onClick={()=>setDecision(null)}>انصراف</button></div></form>}
  </Card>;
}
