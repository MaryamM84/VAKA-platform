"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMyProfile, type MyProfile } from "@/lib/profile-api";
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
  {
    label: "احراز هویت",
    href: "/profile/verification",
    icon: "shield-check",
  },
];

const skillsMenuItem = {
  label: "مهارت‌ها و شرایط فعالیت",
  href: "/profile/skills",
  icon: "briefcase-business",
};

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

    "briefcase-business": (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
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

    "shield-check": (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
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
      return "احراز هویت تأیید شده";

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

  const [selectedAvatar, setSelectedAvatar] = useState("avatar-04");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentAvatar =
    uploadedImage ||
    avatars.find((avatar) => avatar.id === selectedAvatar)?.src ||
    avatars[3].src;

  const verificationLabel = getVerificationLabel(
    profile?.verification_status
  );

  const verified = isVerified(profile?.verification_status);
  const menuItems = verified
    ? [
        baseMenuItems[0],
        skillsMenuItem,
        ...baseMenuItems.slice(1, 3),
        workerMenuItem,
        baseMenuItems[3],
      ]
    : baseMenuItems;

  // دریافت اطلاعات پروفایل از API
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const data = await getMyProfile();

        if (isMounted) {
          setProfile(data);
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

  // بررسی و بارگذاری تصویر انتخاب‌شده
  function handleImageUpload(file?: File) {
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

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedImage(reader.result);
        setIsAvatarModalOpen(false);
      }
    };

    reader.onerror = () => {
      setUploadError("خواندن تصویر با خطا مواجه شد. دوباره تلاش کنید.");
    };

    reader.readAsDataURL(file);
  }

  // انتخاب آواتار پیش‌فرض
  function chooseAvatar(avatarId: string) {
    setSelectedAvatar(avatarId);
    setUploadedImage(null);
    setIsAvatarModalOpen(false);
    setUploadError("");
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
          <Image
            src={currentAvatar}
            alt="تصویر پروفایل"
            width={112}
            height={112}
            className={styles.avatar}
            unoptimized={!!uploadedImage}
          />

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

        {/* وضعیت احراز هویت از API */}
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
                className={styles.fileInput}
                onChange={(event) => {
                  handleImageUpload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />

              <span className={styles.uploadIcon} aria-hidden="true">
                ↑
              </span>

              <strong>بارگذاری تصویر از دستگاه</strong>

              <span>فرمت تصویری، حداکثر ۵ مگابایت</span>
              <span>
                توجه: API فعلی واکا بارگذاری تصویر را پشتیبانی نمی‌کند؛ این تغییر فعلاً فقط در همین نشست نمایش داده می‌شود.
              </span>
            </label>

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
              {avatars.map((avatar) => {
                const isSelected =
                  !uploadedImage &&
                  selectedAvatar === avatar.id;

                return (
                  <button
                    type="button"
                    key={avatar.id}
                    className={`${styles.modalAvatarOption} ${
                      isSelected
                        ? styles.modalAvatarSelected
                        : ""
                    }`}
                    onClick={() => chooseAvatar(avatar.id)}
                    aria-label={avatar.alt}
                    aria-pressed={isSelected}
                  >
                    <Image
                      src={avatar.src}
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