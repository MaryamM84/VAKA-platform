"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./ProfilePage.module.css";
import { getMyProfile, getMyAvatar, type MyProfile, type ProfileAvatar } from "@/lib/profile-api";

function getVerificationLabel(status?: string) {
  switch (status?.toUpperCase()) {
    case "VERIFIED":
    case "APPROVED":
      return "تأیید شده";

    case "PENDING":
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "در حال بررسی";

    case "REJECTED":
      return "رد شده";

    case "NOT_SUBMITTED":
    case "UNVERIFIED":
      return "تکمیل‌نشده";

    default:
      return "نامشخص";
  }
}

function isVerified(status?: string) {
  return ["VERIFIED", "APPROVED"].includes(
    status?.toUpperCase() ?? ""
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avatar, setAvatar] = useState<ProfileAvatar | null>(null);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const data = await getMyProfile();
      setProfile(data);
      const avatarData = await getMyAvatar().catch(() => null);
      setAvatar(avatarData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "دریافت اطلاعات پروفایل ناموفق بود."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const refreshAvatar = (event: Event) => {
      const detail = (event as CustomEvent<ProfileAvatar>).detail;
      if (detail?.avatar_url !== undefined) setAvatar(detail);
      else void getMyAvatar().then(setAvatar).catch(() => undefined);
    };
    window.addEventListener("vaka:profile-updated", refreshAvatar);
    return () => window.removeEventListener("vaka:profile-updated", refreshAvatar);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchProfile() {
      try {
        const data = await getMyProfile();
        const avatarData = await getMyAvatar().catch(() => null);
        if (isMounted) {
          setProfile(data);
          setAvatar(avatarData);
          setError("");
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "دریافت اطلاعات پروفایل ناموفق بود."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className={styles.profileContent} role="status">
        در حال دریافت اطلاعات پروفایل...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.profileContent} role="alert">
        <p>{error || "اطلاعات پروفایل دریافت نشد."}</p>

        <button type="button" onClick={loadProfile}>
          تلاش مجدد
        </button>
      </div>
    );
  }

  const verificationLabel = getVerificationLabel(
    profile.verification_status
  );

  const verified = isVerified(profile.verification_status);

  return (
    <div className={styles.profileContent}>
      <section className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <div>
            <h2>
              {profile.full_name?.trim() || "نام کاربر ثبت نشده"}

              {verified && (
                <span
                  className={styles.verified}
                  aria-label="حساب تأیید شده"
                >
                  ✓
                </span>
              )}
            </h2>

            <p>
              {profile.bio?.trim() ||
                "هنوز توضیحی برای پروفایل ثبت نشده است."}
            </p>
          </div>
        </div>

        <div className={styles.summaryDivider} />
      </section>

      <div className={styles.bottomCards}>
        <section className={styles.accountCard}>
          <h3>اطلاعات حساب</h3>

          <div className={styles.infoRow}>
            <span>شماره موبایل</span>

            <strong className={styles.phoneNumber} dir="ltr">
              {profile.phone || "ثبت نشده"}
            </strong>
          </div>

          <div className={styles.infoRow}>
            <span>ایمیل</span>

            <strong dir="ltr">
              {profile.email || "ثبت نشده"}
            </strong>
          </div>

          <div className={styles.infoRow}>
            <span>وضعیت احراز هویت</span>

            <span
              className={
                verified
                  ? styles.confirmedBadge
                  : styles.pendingBadge
              }
            >
              {verificationLabel}
            </span>
          </div>
        </section>

        <section className={styles.verificationCard}>
          <span
            className={
              verified
                ? styles.confirmedBadge
                : styles.warningBadge
            }
          >
            {verificationLabel}
          </span>

          <h3>
            {verified
              ? "احراز هویت حساب شما تأیید شده است"
              : "برای شروع فعالیت، احراز هویت خود را تکمیل کنید"}
          </h3>

          <p>
            وضعیت احراز هویت بر اساس اطلاعات حساب شما دریافت شده است.
            برای مشاهده یا ادامه فرایند احراز هویت از بخش مربوطه استفاده کنید.
          </p>

          {!verified && (
            <Link
              href="/profile/verification"
              className={styles.verificationButton}
            >
              شروع احراز هویت
              <span>←</span>
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}