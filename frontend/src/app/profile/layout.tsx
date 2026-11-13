
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProfileSidebar from "@/components/layout/profile/ProfileSidebar";
import styles from "./ProfileLayout.module.css";

export default function ProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isEditPage = pathname === "/profile/edit";
  const isVerificationPage = pathname === "/profile/verification";

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.pageHeader}>
        <div>
          <h1>
            {isVerificationPage
              ? "احراز هویت"
              : isEditPage
                ? "ویرایش پروفایل"
                : "پروفایل من"}
          </h1>

          <p>
            {isVerificationPage
              ? "اطلاعات هویتی خود را برای تکمیل فرایند احراز هویت وارد کنید."
              : isEditPage
                ? "اطلاعات شخصی و مشخصات حساب کاربری خود را ویرایش کنید."
                : "اطلاعات شخصی و وضعیت حساب کاربری شما"}
          </p>
        </div>

        {!isVerificationPage && !isEditPage && (
          <Link href="/profile/edit" className={styles.editButton}>
            <span aria-hidden="true">✎</span>
            ویرایش پروفایل
          </Link>
        )}
      </header>

      <div
        className={`${styles.profileLayout} ${
          isEditPage ? styles.editPageLayout : ""
        }`}
      >
        <div className={styles.sidebarColumn}>
          <ProfileSidebar />
        </div>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
