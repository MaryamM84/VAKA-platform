import type { Metadata } from "next";
import ProfileVerification from "@/components/profile-verification/ProfileVerification";

export const metadata: Metadata = {
  title: "احراز هویت | واکا",
  description: "تکمیل اطلاعات هویتی برای فعالیت به‌عنوان مجری در واکا",
};

export default function VerificationPage() {
  return <ProfileVerification />;
}