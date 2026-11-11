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
  {isEditPage
    ? "ویرایش پروفایل"
    : isVerificationPage
      ? "احراز هویت"
      : "پروفایل من"}
</h1>

<p>
  {isEditPage
    ? "اطلاعات شخصی و مشخصات حساب کاربری خود را ویرایش کنید."
    : isVerificationPage
      ? "اطلاعات هویتی خود را برای فعالیت به‌عنوان مجری تکمیل کنید."
      : "اطلاعات شخصی و وضعیت حساب کاربری شما"}
</p>
        </div>

        {!isEditPage && (
          <Link href="/profile/edit" className={styles.editButton}>
            <span>✎</span>
            ویرایش پروفایل
          </Link>
        )}
      </header>

      <div className={styles.profileLayout}>
        <div className={styles.sidebarColumn}>
          <ProfileSidebar />
        </div>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}