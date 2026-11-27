import type { ApiVerificationStatus } from "@/lib/verification-api";
import styles from "./Admin.module.css";
export const labels: Record<ApiVerificationStatus, string> = { PENDING: "در انتظار بررسی", APPROVED: "تأیید شده", REJECTED: "رد شده", NOT_SUBMITTED: "ارسال نشده" };
export const number = (n: number) => n.toLocaleString("fa-IR");
export const date = (value: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran" }).format(new Date(value)) : "—";
export function Status({ status }: { status: ApiVerificationStatus }) { return <span className={`${styles.status} ${styles[status] || ""}`}>{status === "APPROVED" ? "✓" : status === "REJECTED" ? "×" : "◷"} {labels[status] ?? status}</span>; }
export function Avatar({ name }: { name: string }) { return <span className={styles.avatar} aria-hidden="true">{name.trim()[0] || "؟"}</span>; }
export const errorText = (error: unknown) => error instanceof Error ? error.message : "خطایی رخ داد.";
