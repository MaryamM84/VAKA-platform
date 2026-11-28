import type { ReactNode } from "react";
import ProfileSidebar from "@/components/layout/profile/ProfileSidebar";
import styles from "./DashboardLayout.module.css";

interface DashboardLayoutProps {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  workflowSteps?: ReactNode;
  variant?: "default" | "workflow";
}

export default function DashboardLayout({
  title,
  description,
  action,
  children,
  workflowSteps,
  variant = "default",
}: DashboardLayoutProps) {
  return (
    <div className={`${styles.pageWrapper} ${variant === "workflow" ? styles.workflow : ""}`}>
      <header className={styles.pageHeader}>
        <div className={styles.heading}>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        {action && <div className={styles.headerAction}>{action}</div>}
      </header>

      {workflowSteps && <div className={styles.workflowSteps}>{workflowSteps}</div>}
      <div className={styles.dashboardGrid}>
        <aside className={styles.sidebarColumn}>
          <ProfileSidebar />
        </aside>

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}