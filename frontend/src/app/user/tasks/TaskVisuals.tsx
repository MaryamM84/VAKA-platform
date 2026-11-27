import type { ReactNode } from "react";

export type TaskIconName = "check" | "shield" | "user" | "chat" | "clock" | "timer" | "lock" | "phone" | "pin" | "list" | "checklist" | "play" | "upload" | "money" | "rocket" | "gauge" | "send" | "close";

export function TaskIcon({ name, className }: { name: TaskIconName; className?: string }) {
  const paths: Record<TaskIconName, ReactNode> = {
    check: <path d="m5 12 4 4L19 6" />,
    shield: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2c0-6 16-6 16 0v2Z"/></>,
    chat: <><path d="M3 4h18v14H8l-5 4V4Z"/><path d="M7 8h10M7 12h7"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/></>,
    timer: <><circle cx="12" cy="14" r="8"/><path d="M9 2h6M12 6V2m6 5 2-2M12 10v6"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M9 10V6a4 4 0 0 1 8 0"/><circle cx="12" cy="15" r="1"/><path d="M12 16v2"/></>,
    phone: <path d="m5 3 4 4-2 3a16 16 0 0 0 7 7l3-2 4 4-2 3C8 22 2 16 2 5l3-2ZM15 3a7 7 0 0 1 6 6m-6-2a3 3 0 0 1 2 2"/>,
    pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    list: <path d="M3 5h18M3 10h18M3 15h18M3 20h11"/>,
    checklist: <><path d="m2 6 2 2 4-4m-6 12 2 2 4-4M12 6h10M12 16h10"/></>,
    play: <path d="m8 4 12 8-12 8V4Z"/>,
    upload: <><path d="M6 2h8l5 5v15H6V2Zm8 0v6h5M12 19V11m-3 4 3-4 3 4"/></>,
    money: <><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 9v6M19 9v6"/></>,
    rocket: <><path d="M9 15c-3-3-1-9 12-13 0 10-5 17-9 15l-3-2Z"/><circle cx="16" cy="7" r="2"/><path d="m8 8-4 1-2 4 6-1m7 4-1 5-4 1 1-6M7 17l-4 4m1-4-2 3m5 0-2 2"/></>,
    gauge: <><path d="M3 17a9 9 0 1 1 18 0H3Z"/><path d="m12 15 5-6"/></>,
    send: <path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15"/>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg className={className} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export const taskNumber = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
export function taskDuration(minutes: number) {
  return `${taskNumber(minutes)} دقیقه`;
}
export function taskDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("fa-IR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
