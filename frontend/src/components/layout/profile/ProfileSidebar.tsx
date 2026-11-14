"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  getMyProfile, getMyAvatar, uploadMyAvatar, selectMyAvatar, notifyProfileUpdated,
  type MyProfile, type ProfileAvatar,
} from "@/lib/profile-api";
import styles from "./ProfileSidebar.module.css";

const avatars = [
  {
    id: "avatar-01",
    src: "/images/avatars/avatar-01-curly-hair.png",
    alt: "آواتار مو فرفری",
  },
  {
    id: "avatar-02",
    src: "/images/avatars/avatar-02-hijab.png",
    alt: "آواتار باحجاب",
  },
  {
    id: "avatar-03",
    src: "/images/avatars/avatar-03-glasses.png",
    alt: "آواتار عینکی",
  },
  {
    id: "avatar-04",
    src: "/images/avatars/avatar-04-long-hair.png",
    alt: "آواتار مو بلند",
  },
  {
    id: "avatar-05",
    src: "/images/avatars/avatar-05-braids-glasses.png",
    alt: "آواتار بافت مو و عینک",
  },
  {
    id: "avatar-06",
    src: "/images/avatars/avatar-06-curly-hoodie.png",
    alt: "آواتار با هودی",
  },
];

const baseMenuItems = [
  {
    label: "پروفایل من",
    href: "/profile",
    icon: "user-round",
  },
  {
    label: "کارهای من",
    href: "/employer/tasks",
    icon: "clipboard-list",
  },
  {
    label: "پیشنهادهای دریافتی",
    href: "/employer/bids",
    icon: "messages-square",
  },
];

const workerMenuItem = {
  label: "پیشنهادهای من",
  href: "/worker/bids",
  icon: "messages-square",
};

function MenuIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    "user-round": (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),

    "clipboard-list": (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" />
      </>
    ),

    "messages-square": (
      <>
        <path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 2v-5.5A7.5 7.5 0 1 1 21 11.5Z" />
        <path d="M8 10h8M8 14h5" />
      </>
    ),

  };

  return (
    <svg
      className={styles.menuIcon}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function getVerificationLabel(status?: string) {
  switch (status?.toUpperCase()) {
    case "VERIFIED":
    case "APPROVED":
      return "مجری و کارفرما";

    case "PENDING":
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "در حال بررسی";

    case "REJECTED":
      return "احراز هویت رد شده";

    case "NOT_SUBMITTED":
    case "UNVERIFIED":
      return "احراز هویت تکمیل نشده";

    default:
      return "وضعیت نامشخص";
  }
}

function isVerified(status?: string) {
  return ["VERIFIED", "APPROVED"].includes(
    status?.toUpperCase() ?? ""
  );
}

export default function ProfileSidebar() {
  const pathname = usePathname();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [avatar, setAvatar] = useState<ProfileAvatar | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const presetIndex = Math.max(0, Number(avatar?.avatar_id?.replace("avatar_", "") ?? 4) - 1);
  const currentAvatar = avatar?.avatar_url || avatars[presetIndex]?.src || avatars[3].src;

  const verificationLabel = getVerificationLabel(
    profile?.verification_status
  );

  const verified = isVerified(profile?.verification_status);
  const menuItems = verified
    ? [...baseMenuItems, workerMenuItem]
    : baseMenuItems;

  // دریافت اطلاعات پروفایل
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const [profileResult, avatarResult] = await Promise.allSettled([getMyProfile(), getMyAvatar()]);
        if (isMounted) {
          if (profileResult.status === "fulfilled") setProfile(profileResult.value);
          if (avatarResult.status === "fulfilled") setAvatar(avatarResult.value);
        }
      } catch (error) {
        console.error("Failed to load sidebar profile:", error);
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const refreshAvatar = (event: Event) => {
      const detail = (event as CustomEvent<ProfileAvatar>).detail;
      if (detail?.avatar_url !== undefined) setAvatar(detail);
      else void getMyAvatar().then(setAvatar).catch(() => undefined);
    };
    window.addEventListener("vaka:profile-updated", refreshAvatar);
    return () => window.removeEventListener("vaka:profile-updated", refreshAvatar);
  }, []);

  // بستن پنجره انتخاب آواتار با کلید Escape
  useEffect(() => {
    if (!isAvatarModalOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAvatarModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isAvatarModalOpen]);

  async function handleImageUpload(file?: File) {
    setUploadError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("لطفاً یک فایل تصویری انتخاب کنید.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("حجم تصویر نباید بیشتر از ۵ مگابایت باشد.");
      return;
    }
    setAvatarSaving(true);
    try {
      const saved = await uploadMyAvatar(file);
      setAvatar(saved);
      notifyProfileUpdated(saved);
      setIsAvatarModalOpen(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "ذخیره تصویر انجام نشد.");
    } finally {
      setAvatarSaving(false);
    }
  }

  async function chooseAvatar(avatarId: string) {
    setUploadError("");
    setAvatarSaving(true);
    try {
      const saved = await selectMyAvatar(avatarId.replace("avatar-0", "avatar_"));
      setAvatar(saved);
      notifyProfileUpdated(saved);
      setIsAvatarModalOpen(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "انتخاب آواتار انجام نشد.");
    } finally {
      setAvatarSaving(false);
    }
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.profileCard}>
        {/* Profile Avatar */}
        <button
          type="button"
          className={styles.avatarButton}
          onClick={() => setIsAvatarModalOpen(true)}
          aria-label="تغییر تصویر پروفایل"
          title="تغییر تصویر پروفایل"
        >
          <img src={currentAvatar} alt="تصویر پروفایل" width={112} height={112} className={styles.avatar} />

          <span className={styles.avatarBadge} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
            </svg>
          </span>
        </button>

        <h2 className={styles.name}>
          {profileLoading
            ? "در حال دریافت..."
            : profile?.full_name?.trim() || "نام کاربر ثبت نشده"}
        </h2>

        {/* وضعیت احراز هویت */}
        {!profileLoading && (
          <div className={styles.roleBadges}>
            <span
              className={
                verified
                  ? styles.primaryBadge
                  : styles.secondaryBadge
              }
            >
              {verificationLabel}
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav
          className={styles.navigation}
          aria-label="منوی پروفایل"
        >
          {menuItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/profile" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.menuItem} ${
                  active ? styles.active : ""
                }`}
                aria-current={active ? "page" : undefined}
              >
                <MenuIcon name={item.icon} />

                <span className={styles.menuLabel}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Avatar Selection Modal */}
      {isAvatarModalOpen && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsAvatarModalOpen(false);
            }
          }}
        >
          <section
            className={styles.avatarModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-modal-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 id="avatar-modal-title">تصویر پروفایل</h3>

                <p>تصویر دلخواه خود را انتخاب کنید.</p>
              </div>

              <button
                type="button"
                className={styles.closeModal}
                onClick={() => setIsAvatarModalOpen(false)}
                aria-label="بستن پنجره"
              >
                ×
              </button>
            </div>

            {/* Upload Image */}
            <label className={styles.uploadArea}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                disabled={avatarSaving}
                className={styles.fileInput}
                onChange={(event) => {
                  void handleImageUpload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />

              <span className={styles.uploadIcon} aria-hidden="true">
                ↑
              </span>

              <strong>بارگذاری تصویر از دستگاه</strong>

              <span>فرمت تصویری، حداکثر ۵ مگابایت</span>
              <span>تصویر پس از ذخیره در تمام بخش‌های حساب نمایش داده می‌شود.</span>
            </label>

            {avatarSaving && <p role="status">در حال ذخیره تصویر...</p>}
            {uploadError && (
              <p className={styles.uploadError} role="alert">
                {uploadError}
              </p>
            )}

            {/* Default Avatars */}
            <div className={styles.avatarModalDivider}>
              <span>یا یکی از آواتارهای زیر را انتخاب کنید</span>
            </div>

            <div className={styles.modalAvatarGrid}>
              {avatars.map((item) => {
                const isSelected = avatar?.avatar_id === item.id.replace("avatar-0", "avatar_");

                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`${styles.modalAvatarOption} ${
                      isSelected
                        ? styles.modalAvatarSelected
                        : ""
                    }`}
                    disabled={avatarSaving}
                    onClick={() => void chooseAvatar(item.id)}
                    aria-label={item.alt}
                    aria-pressed={isSelected}
                  >
                    <Image
                      src={item.src}
                      alt=""
                      width={68}
                      height={68}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}