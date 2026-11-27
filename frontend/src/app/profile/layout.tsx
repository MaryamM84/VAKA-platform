
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
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
  const isWalletPage = pathname === "/profile/wallet";
  const isVerificationPage = pathname === "/profile/verification";

  const isSkillsPage =
    pathname === "/profile/skills" ||
    pathname.startsWith("/profile/skills/");

  return (
    <div className={styles.pageWrapper}>
      {!isSkillsPage && (
        <header className={styles.pageHeader}>
          <div>
            <h1>
              {isWalletPage
                ? "کیف پول من"
                : isVerificationPage
                  ? "احراز هویت"
                  : isEditPage
                    ? "ویرایش پروفایل"
                    : "پروفایل من"}
            </h1>

            <p>
              {isWalletPage
                ? "مشاهده موجودی و تراکنش‌های مالی شما"
                : isVerificationPage
                  ? "اطلاعات هویتی خود را برای تکمیل فرایند احراز هویت وارد کنید."
                  : isEditPage
                    ? "اطلاعات شخصی و مشخصات حساب کاربری خود را ویرایش کنید."
                    : "اطلاعات شخصی و وضعیت حساب کاربری شما"}
            </p>
          </div>

          {!isVerificationPage &&
            !isEditPage &&
            !isWalletPage && (
              <Link
                href="/profile/edit"
                className={styles.editButton}
              >
                <span aria-hidden="true">✎</span>
                ویرایش پروفایل
              </Link>
            )}
        </header>
      )}

      <div
        className={`${styles.profileLayout} ${
          isEditPage ? styles.editPageLayout : ""
        }`}
      >
        <div className={styles.sidebarColumn}>
          <ProfileSidebar />

          {isWalletPage && (
            <div className={styles.walletCharacterWrap}>
              <Image
                src="/images/wallet-girl.png"
                alt="شخصیت کیف پول"
                width={320}
                height={400}
                priority
                className={styles.walletCharacter}
              />
            </div>
          )}
        </div>

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
