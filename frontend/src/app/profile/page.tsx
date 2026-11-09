
import Link from "next/link";
import styles from "./ProfilePage.module.css";

export default function ProfilePage() {
  return (
    <div className={styles.profileContent}>
      {/* Profile summary */}
      <section className={styles.summaryCard}>

        <div className={styles.summaryHeader}>
          <div>
            <h2>
              مریم احمدی
              <span className={styles.verified}>✓</span>
            </h2>
            <p>عضو واکا از اردیبهشت ۱۴۰۳</p>
          </div>

        </div>

        <div className={styles.summaryDivider} />

        <div className={styles.statistics}>
          <div className={styles.statItem}>
            <strong>۱۲</strong>
            <span>تسک تکمیل‌شده</span>
          </div>

          <div className={styles.statItem}>
            <strong>۸</strong>
            <span>تسک ناتمام</span>
          </div>

          <div className={styles.statItem}>
            <strong className={styles.rating}>★ ۴.۸</strong>
            <span>امتیاز کارفرما</span>
          </div>
        </div>
      </section>

      {/* Account information and verification */}
      <div className={styles.bottomCards}>
        <section className={styles.accountCard}>
          <h3>اطلاعات حساب</h3>

          <div className={styles.infoRow}>
            <span>شماره موبایل</span>
            <div>
              <strong className={styles.phoneNumber}>
                ۰۹۱۲ ۳۴۵ ۶۷۸۹
              </strong>
              <span className={styles.confirmedBadge}>تأییدشده</span>
            </div>
          </div>

          <div className={styles.infoRow}>
            <span>وضعیت احراز هویت</span>
            <span className={styles.pendingBadge}>تکمیل‌نشده</span>
          </div>

          <div className={styles.infoRow}>
            <span>نوع حساب</span>
            <strong>کارفرما</strong>
          </div>
        </section>

        <section className={styles.verificationCard}>
          <span className={styles.warningBadge}>نیازمند تکمیل</span>

          <h3>به‌عنوان مجری فعالیت کنید</h3>

          <p>
            با تکمیل احراز هویت، می‌توانید برای تسک‌ها پیشنهاد ارسال
            کنید و درآمد داشته باشید.
          </p>

          <Link
            href="/worker/verification"
            className={styles.verificationButton}
          >
            شروع احراز هویت
            <span>←</span>
          </Link>
        </section>
      </div>
    </div>
  );
}
