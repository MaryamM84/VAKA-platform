"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import styles from "./WorkerProfile.module.css";
import { getPublicWorkerProfile, type PublicWorkerProfile } from "@/lib/profile-api";

function formatNumber(value: number | string) {
  return new Intl.NumberFormat("fa-IR").format(Number(value ?? 0));
}

function WorkerProfileContent() {
  const params = useParams<{ workerId: string }>();
  const workerId = params.workerId;
  const [worker, setWorker] = useState<PublicWorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workerId) return;
    let active = true;
    setLoading(true);
    getPublicWorkerProfile(workerId)
      .then((data) => { if (active) setWorker(data); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "دریافت پروفایل مجری انجام نشد.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workerId]);

  if (loading) {
    return <DashboardLayout title="پروفایل مجری" description="خلاصه اطلاعات و سوابق مجری">
      <div className={styles.emptyState}>در حال دریافت پروفایل مجری...</div>
    </DashboardLayout>;
  }

  if (error || !worker) {
    return <DashboardLayout title="پروفایل مجری" description="خلاصه اطلاعات و سوابق مجری">
      <div className={styles.emptyState}>
        <strong>{error || "پروفایل موردنظر پیدا نشد."}</strong>
        <Link href="/employer/bids">بازگشت به پیشنهادهای دریافتی</Link>
      </div>
    </DashboardLayout>;
  }

  const skills = (worker.skills ?? []).map((skill) =>
    typeof skill === "string" ? skill : skill.name || skill.skill_name || ""
  ).filter(Boolean);
  const verified = ["VERIFIED", "APPROVED"].includes(worker.verification_status?.toUpperCase());

  return (
    <DashboardLayout title="پروفایل مجری" description="خلاصه اطلاعات و سوابق مجری در واکا">
      <div className={styles.profileContent}>
        <section className={styles.summaryCard}>
          <div className={styles.profileHeader}>
            <div className={styles.avatar}>
              {worker.avatar_url
                ? <img src={worker.avatar_url} alt="" />
                : (worker.full_name || "م").charAt(0)}
            </div>
            <div className={styles.identity}>
              <div className={styles.nameRow}>
                <h2>{worker.full_name || "مجری واکا"}</h2>
                {verified && <span className={styles.verified}>✓ احراز هویت‌شده</span>}
              </div>
              <p>{worker.bio || "توضیحاتی برای این پروفایل ثبت نشده است."}</p>
              <span className={styles.location}>{[worker.city, worker.province].filter(Boolean).join("، ") || "موقعیت ثبت نشده"}</span>
            </div>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.statistics}>
            <div className={styles.statItem}>
              <strong>{formatNumber(worker.completed_tasks_count)}</strong><span>کار تکمیل‌شده</span>
            </div>
            <div className={styles.statItem}>
              <strong>{formatNumber(worker.active_tasks_count)}</strong><span>کار فعال</span>
            </div>
            <div className={styles.statItem}>
              <strong className={styles.rating}>★ {worker.average_rating == null ? "—" : formatNumber(worker.average_rating)}</strong>
              <span>{formatNumber(worker.rating_count)} امتیاز</span>
            </div>
          </div>
        </section>
        <div className={styles.detailsGrid}>
          <section className={styles.infoCard}>
            <h3>درباره مجری</h3>
            <p className={styles.aboutText}>{worker.bio || "توضیحی ثبت نشده است."}</p>
          </section>
          <section className={styles.infoCard}>
            <h3>مهارت‌ها</h3>
            <div className={styles.skills}>
              {skills.length ? skills.map((skill, index) => <span key={`${skill}-${index}`}>{skill}</span>) : <p>مهارتی ثبت نشده است.</p>}
            </div>
          </section>
        </div>
        <div className={styles.backLinkWrapper}>
          <Link href="/employer/bids">بازگشت به پیشنهادهای دریافتی</Link>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function WorkerProfilePage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout
          title="پروفایل مجری"
          description="خلاصه اطلاعات و سوابق مجری"
        >
          <div className={styles.emptyState}>
            در حال دریافت پروفایل مجری...
          </div>
        </DashboardLayout>
      }
    >
      <WorkerProfileContent />
    </Suspense>
  );
}