"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ADMIN_PATH } from "@/lib/admin-api";
import { useAdminAccess } from "./AdminAccess";
import styles from "./Admin.module.css";

export default function AdminHeader() {
  const { user } = useAdminAccess();
  const router = useRouter();

  function logout() {
    localStorage.removeItem("vaka.auth");
    sessionStorage.removeItem("vaka.auth");
    window.dispatchEvent(new Event("vaka:auth-changed"));
    router.replace("/login");
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerShell}>
        <Link href={ADMIN_PATH} className={styles.brand}>
          <Image
            src="/images/main logo.png"
            width={58}
            height={58}
            alt=""
          />

          <span>
            واکا
            <br />
            <b lang="en">VaKa</b>
          </span>

          <Image
            className={styles.illustration}
            src="/images/header-illustration.png"
            width={100}
            height={100}
            alt=""
          />
        </Link>

        <nav
          aria-label="منوی ادمین"
          className={styles.nav}
        >
          <Link
            className={styles.active}
            href={ADMIN_PATH}
          >
            داشبورد
          </Link>

          <details>
            <summary>درخواست‌ها</summary>

            <div className={styles.dropdown}>
              <Link href="/admin/worker-verifications">
                احراز هویت
              </Link>
            </div>
          </details>

          <Link href="/admin/executors">لیست مجریان</Link>
          <Link href="/admin/categories">دسته‌بندی‌ها</Link>
        </nav>

        <div className={styles.headerActions}>
          <details>
            <summary aria-label="حساب کاربری">
              <span className={styles.initial}>
                {user?.full_name?.trim()[0] || "م"}
              </span>
            </summary>

            <div className={styles.dropdown}>
              <button onClick={logout}>
                خروج از حساب
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}