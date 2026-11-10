
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/dashboard/DashboardLayout";
import styles from "./WorkerProfile.module.css";

type WorkerProfileData = {
  name: string;
  specialty: string;
  city: string;
  joinedAt: string;
  rating: number;
  completedTasks: number;
  unfinishedTasks: number;
  verified: boolean;
  about: string;
  skills: string[];
};

const workers: Record<number, WorkerProfileData> = {
  1: {
    name: "سارا محمدی",
    specialty: "طراح رابط کاربری و تجربه کاربری",
    city: "تهران",
    joinedAt: "اردیبهشت ۱۴۰۳",
    rating: 4.9,
    completedTasks: 78,
    unfinishedTasks: 2,
    verified: true,
    about:
      "در زمینه طراحی رابط کاربری و تجربه کاربری فعالیت می‌کنم. علاقه‌مند به طراحی محصولات دیجیتال ساده، کاربردی و کاربرپسند هستم و تجربه همکاری در پروژه‌های مختلف را دارم.",
    skills: ["UI Design", "UX Design", "Figma", "Prototyping"],
  },
  2: {
    name: "مریم محمدی",
    specialty: "طراح رابط کاربری",
    city: "اصفهان",
    joinedAt: "خرداد ۱۴۰۳",
    rating: 4.8,
    completedTasks: 64,
    unfinishedTasks: 1,
    verified: true,
    about:
      "طراح رابط کاربری هستم و به طراحی تجربه‌های ساده و قابل‌فهم برای کاربران علاقه دارم. در پروژه‌های طراحی وب و اپلیکیشن فعالیت داشته‌ام.",
    skills: ["UI Design", "Figma", "Web Design"],
  },
  3: {
    name: "آرش کریمی",
    specialty: "طراح UI/UX",
    city: "شیراز",
    joinedAt: "مهر ۱۴۰۳",
    rating: 4.7,
    completedTasks: 52,
    unfinishedTasks: 3,
    verified: true,
    about:
      "در حوزه طراحی محصول دیجیتال فعالیت می‌کنم و تلاش می‌کنم راهکارهایی متناسب با نیاز کاربران و اهداف کسب‌وکار ارائه دهم.",
    skills: ["UI/UX", "Wireframing", "Figma"],
  },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

export default function WorkerProfilePage() {
  const params = useParams<{ workerId: string }>();
  const workerId = Number(params.workerId);
  const worker = workers[workerId];

  if (!worker) {
    return (
      <DashboardLayout
        title="پروفایل کاربر"
        description="مشاهده اطلاعات کاربر"
      >
        <div className={styles.emptyState}>
          <strong>پروفایل موردنظر پیدا نشد.</strong>
          <Link href="/employer/tasks">بازگشت به کارهای من</Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="پروفایل کاربر"
      description="مشاهده اطلاعات و سوابق فعالیت کاربر در واکا"
    >
      <div className={styles.profileContent}>
        <section className={styles.summaryCard}>
          <div className={styles.profileHeader}>
            <div className={styles.avatar}>
              {worker.name.charAt(0)}
            </div>

            <div className={styles.identity}>
              <div className={styles.nameRow}>
                <h2>{worker.name}</h2>
                {worker.verified && (
                  <span className={styles.verified}>✓ احراز هویت‌شده</span>
                )}
              </div>

              <p>{worker.specialty}</p>
              <span className={styles.location}>{worker.city}</span>
              <span className={styles.joinDate}>
                عضو واکا از {worker.joinedAt}
              </span>
            </div>
          </div>

          <div className={styles.summaryDivider} />

          <div className={styles.statistics}>
            <div className={styles.statItem}>
              <strong>{formatNumber(worker.completedTasks)}</strong>
              <span>کار تکمیل‌شده</span>
            </div>

            <div className={styles.statItem}>
              <strong>{formatNumber(worker.unfinishedTasks)}</strong>
              <span>کار ناتمام</span>
            </div>

            <div className={styles.statItem}>
              <strong className={styles.rating}>
                ★ {formatNumber(worker.rating)}
              </strong>
              <span>امتیاز کاربر</span>
            </div>
          </div>
        </section>

        <div className={styles.detailsGrid}>
          <section className={styles.infoCard}>
            <h3>درباره من</h3>
            <p className={styles.aboutText}>{worker.about}</p>
          </section>

          <section className={styles.infoCard}>
            <h3>مهارت‌ها</h3>

            <div className={styles.skills}>
              {worker.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.backLinkWrapper}>
          <Link href="/employer/tasks">بازگشت به کارهای من</Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
