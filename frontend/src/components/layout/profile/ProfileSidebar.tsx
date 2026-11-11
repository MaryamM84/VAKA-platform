
"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

const menuItems = [
  {
    label: "پروفایل من",
    href: "/profile",
    icon: "user-round",
  },
  {
    label: "ویرایش پروفایل",
    href: "/profile/edit",
    icon: "user-pen",
  },
  {
    label: "تسک‌های من",
    href: "/employer/tasks",
    icon: "clipboard-list",
  },
  {
    label: "پیشنهادهای دریافتی",
    href: "/worker/bids",
    icon: "messages-square",
    badge: "۲ جدید",
  },
  {
    label: "احراز هویت و امنیت",
    href: "/profile/verification",
    icon: "shield-check",
  },
];

function MenuIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    "user-round": (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),

    "user-pen": (
      <>
        <circle cx="10" cy="8" r="4" />
        <path d="M3 21a7 7 0 0 1 12-5" />
        <path d="m16 19 5-5 2 2-5 5-3 1z" />
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

export default function ProfileSidebar() {
  const pathname = usePathname();

  const [selectedAvatar, setSelectedAvatar] = useState("avatar-04");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentAvatar =
    uploadedImage ||
    avatars.find((avatar) => avatar.id === selectedAvatar)?.src ||
    avatars[3].src;

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
      setUploadError(
        "خواندن تصویر با خطا مواجه شد. دوباره تلاش کنید."
      );
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

          <span
            className={styles.avatarBadge}
            aria-hidden="true"
          >
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

        <h2 className={styles.name}>مریم احمدی</h2>

        <div className={styles.roleBadges}>
          <span className={styles.secondaryBadge}>
            کارفرما و مجری
          </span>

          <span className={styles.primaryBadge}>
            مجری فعال
          </span>
        </div>

        {/* Statistics */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <strong>۱۲ تسک</strong>
            <span>انجام موفق</span>
          </div>

          <div className={styles.statDivider} />

          <div className={styles.stat}>
            <strong className={styles.rating}>★ ۴.۸</strong>
            <span>امتیاز کاربران</span>
          </div>
        </div>

        {/* Profile Completion */}
        <div className={styles.completion}>
          <div className={styles.completionHeader}>
            <span>تکمیل پروفایل</span>
            <span>۸۵٪</span>
          </div>

          <div className={styles.progressTrack}>
            <div className={styles.progressValue} />
          </div>

          <p>
            با تکمیل پروفایل، اعتماد بیشتری بسازید.
          </p>
        </div>

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

                {item.badge && (
                  <span className={styles.menuBadge}>
                    {item.badge}
                  </span>
                )}
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
                <h3 id="avatar-modal-title">
                  تصویر پروفایل
                </h3>

                <p>
                  تصویر دلخواه خود را انتخاب کنید.
                </p>
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

              <span
                className={styles.uploadIcon}
                aria-hidden="true"
              >
                ↑
              </span>

              <strong>
                بارگذاری تصویر از دستگاه
              </strong>

              <span>
                فرمت تصویری، حداکثر ۵ مگابایت
              </span>
            </label>

            {uploadError && (
              <p
                className={styles.uploadError}
                role="alert"
              >
                {uploadError}
              </p>
            )}

            {/* Default Avatars */}
            <div className={styles.avatarModalDivider}>
              <span>
                یا یکی از آواتارهای زیر را انتخاب کنید
              </span>
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
