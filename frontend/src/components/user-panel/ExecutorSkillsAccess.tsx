"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getMyProfile } from "@/lib/profile-api";

type AccessState = "checking" | "allowed" | "denied" | "unavailable";

export default function ExecutorSkillsAccess({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [accessState, setAccessState] = useState<AccessState>("checking");

  useEffect(() => {
    let active = true;

    getMyProfile()
      .then((profile) => {
        if (!active) return;

        if (profile.role_codes?.includes("EXECUTOR")) {
          setAccessState("allowed");
          return;
        }

        setAccessState("denied");
        router.replace("/profile");
      })
      .catch(() => {
        if (!active) return;

        // Keep the page previewable while the local backend is unavailable.
        // Production remains fail-closed.
        if (process.env.NODE_ENV === "development") {
          setAccessState("allowed");
        } else {
          setAccessState("unavailable");
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (accessState === "allowed") return <>{children}</>;

  if (accessState === "unavailable") {
    return (
      <div role="status" style={{ padding: 24, textAlign: "center" }}>
        برای بررسی دسترسی به این بخش، اتصال به سرور برقرار نشد. لطفاً دوباره تلاش کنید.
      </div>
    );
  }

  if (accessState === "denied") return null;

  return (
    <div role="status" style={{ padding: 24, textAlign: "center" }}>
      در حال بررسی دسترسی به بخش مهارت‌ها و شرایط فعالیت...
    </div>
  );
}
