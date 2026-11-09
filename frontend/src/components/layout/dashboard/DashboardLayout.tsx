import type { ReactNode } from "react";
import ProfileSidebar from "@/components/layout/profile/ProfileSidebar";
import styles from "./DashboardLayout.module.css";

interface DashboardLayoutProps {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}

export default function DashboardLayout({
  title,
  description,
  action,
  children,
}: DashboardLayoutProps) {
  return (
    <div className={styles.pageWrapper}>
      <header className={styles.pageHeader}>
        <div className={styles.heading}>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        {action && <div className={styles.headerAction}>{action}</div>}
      </header>

      <div className={styles.dashboardGrid}>
        <aside className={styles.sidebarColumn}>
          <ProfileSidebar />
        </aside>

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}