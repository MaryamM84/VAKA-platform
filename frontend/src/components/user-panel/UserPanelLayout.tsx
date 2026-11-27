import type { ReactNode } from "react";
import Link from "next/link";
import ProfileSidebar from "@/components/layout/profile/ProfileSidebar";
import styles from "./UserPanelLayout.module.css";

type UserPanelLayoutProps = {
  children: ReactNode;
  profileName: string;
  completion: number;
  rating?: number;
  completedTaskCount?: number;
  receivedOffersCount?: number;
  activePage?: "profile" | "skills" | "tasks" | "offers" | "security";
  isVerified?: boolean;
  taskMenuLabel?: string;
};

export default function UserPanelLayout({ children, activePage, taskMenuLabel }: UserPanelLayoutProps) {
  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="مسیر صفحه">
          <Link href="/">خانه</Link>
          <span aria-hidden="true">/</span>
          <Link href="/profile">پروفایل من</Link>
          <span aria-hidden="true">/</span>
          <strong>{activePage === "tasks" ? "کار های برای انجام من" : "مهارت‌ها و تنظیمات مجری"}</strong>
        </nav>
        <div className={styles.columns}>
          <main className={styles.content}>{children}</main>
          <div className={styles.sidebar}><ProfileSidebar taskMenuLabel={taskMenuLabel} /></div>
        </div>
      </div>
    </div>
  );
}
