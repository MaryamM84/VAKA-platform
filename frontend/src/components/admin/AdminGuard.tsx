"use client";

import Link from "next/link";
import { useAdminAccess } from "@/components/admin/AdminAccess";
import styles from "@/components/admin/Admin.module.css";

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { access, retry } = useAdminAccess();

  if (access === "allowed") return children;

  return (
    <main className={styles.page}>
      <div className="vaka-card p-8 text-center" role="status">
        {access === "checking" ? (
          "در حال بررسی دسترسی..."
        ) : access === "guest" ? (
          <Link href="/login">
            برای ورود به پنل وارد حساب شوید.
          </Link>
        ) : access === "error" ? (
          <>
            <p>بررسی دسترسی ناموفق بود.</p>
            <button
              className="vaka-secondary-button"
              onClick={retry}
            >
              تلاش مجدد
            </button>
          </>
        ) : (
          <>
            <p>دسترسی به پنل ادمین مجاز نیست.</p>
            <Link href="/">بازگشت به خانه</Link>
          </>
        )}
      </div>
    </main>
  );
}