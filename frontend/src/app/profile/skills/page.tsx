import type { Metadata } from "next";
import UserSkillsPage from "@/components/user-panel/UserSkillsPage";

export const metadata: Metadata = {
  title: "مدیریت مهارت‌ها و شرایط فعالیت | واکا",
  description: "مدیریت مهارت‌ها، دسته‌بندی‌های کاری، مناطق تحت پوشش و زمان‌های فعالیت در واکا.",
};

export default function ProfileSkillsRoute() {
  return <UserSkillsPage />;
}
