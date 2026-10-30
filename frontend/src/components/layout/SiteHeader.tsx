"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import styles from "./SiteHeader.module.css";

type IconName = "chevron" | "search" | "bell" | "plus" | "menu" | "close" | "user" | "logout";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths = {
    chevron: <path d="m6 9 6 6 6-6" />,
    search: <><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.4-4.1 3-6.5 7.5-6.5s7.1 2.4 7.5 6.5" /></>,
    logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M15 16l4-4-4-4M19 12H9" /></>,
  } satisfies Record<IconName, React.ReactNode>;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

type StoredUser = { full_name: string; phone: string };
const AUTH_KEY = "vaka.auth";

function getAuthSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(AUTH_KEY) || window.sessionStorage.getItem(AUTH_KEY) || "";
  } catch {
    return "";
  }
}

function subscribeToAuth(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("vaka:auth-changed", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("vaka:auth-changed", notify);
  };
}

function useCurrentUser(): StoredUser | null {
  const raw = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, () => "");
  return useMemo(() => {
    if (!raw) return null;
    try {
      const data: unknown = JSON.parse(raw);
      if (data === null || typeof data !== "object") return null;
      const session = data as Record<string, unknown>;
      if (typeof session.access !== "string" || !session.access) return null;
      if (!session.user || typeof session.user !== "object") return null;
      const user = session.user as Record<string, unknown>;
      return {
        full_name: typeof user.full_name === "string" ? user.full_name : "",
        phone: typeof user.phone === "string" ? user.phone : "",
      };
    } catch {
      return null;
    }
  }, [raw]);
}

function SearchBox({ mobile = false }: { mobile?: boolean }) {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState(false);
  return (
    <div className={mobile ? styles.mobileSearchContainer : styles.searchContainer}>
      <form className={styles.searchForm} role="search" onSubmit={(event) => {
        event.preventDefault();
        if (query.trim()) setNotice(true);
      }}>
        <button type="submit" className={styles.searchButton} aria-label="جست‌وجو">
          <Icon name="search" size={19} />
        </button>
        <input type="search" aria-label="جست‌وجو در وظایف و متخصصان"
          placeholder="جستجو در وظایف، متخصصان و..." value={query}
          onChange={(event) => { setQuery(event.target.value); setNotice(false); }} />
      </form>
      {notice && <p role="status" className={styles.searchNotice}>
        جست‌وجو هنوز به سرویس مربوطه متصل نشده است.
      </p>}
    </div>
  );
}

export default function SiteHeader() {
  const user = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const displayName = user?.full_name.trim() || user?.phone || "حساب من";
  const avatarInitial = user?.full_name.trim().charAt(0).toUpperCase() || "م";

  function logout() {
    try {
      window.localStorage.removeItem(AUTH_KEY);
      window.sessionStorage.removeItem(AUTH_KEY);
    } catch { /* Storage may be disabled. */ }
    window.dispatchEvent(new Event("vaka:auth-changed"));
  }

  return (
    <header className={styles.header}>
      <span className={styles.decorMint} aria-hidden="true" />
      <span className={styles.decorPeach} aria-hidden="true" />
      <span className={styles.decorDot} aria-hidden="true" />
      <div className={styles.shell}>
        <Link href="/" className={styles.brand} aria-label="واکا، صفحه اصلی">
          <Image
            src="/images/main logo.png"
            alt=""
            width={104}
            height={94}
            className={styles.brandSymbol}
            priority
          />
          <span className={styles.brandWords}>
            <span className={styles.brandFa}>واکا</span>
            <span className={styles.brandEn} lang="en">VaKa</span>
          </span>
        </Link>

        <Image src="/images/header-illustration.png" alt="" width={220} height={176}
          className={styles.illustration} priority aria-hidden="true" />

        <nav className={styles.desktopNav} aria-label="منوی اصلی">
          <Link href="/" aria-current="page" className={styles.homeLink}>خانه</Link>
          <details className={styles.navDetails}>
            <summary className={styles.navSummary}>
              خدمات و دسته‌بندی‌ها <Icon name="chevron" size={18} />
            </summary>
            <div className={styles.dropdown}>
              <p className={styles.dropdownTitle}>خدمات واکا</p>
              <Link href="/employer/tasks/create" className={styles.dropdownLink}>ثبت یک کار جدید</Link>
              <p className={styles.dropdownNote}>مرور دسته‌بندی‌ها و کارها به‌زودی فعال می‌شود.</p>
            </div>
          </details>
          <details className={styles.navDetails}>
            <summary className={styles.navSummary}>
              ارتباط و پشتیبانی <Icon name="chevron" size={18} />
            </summary>
            <div className={styles.dropdown}>
              <p className={styles.dropdownTitle}>ارتباط و پشتیبانی</p>
              <p className={styles.dropdownNote}>مرکز پشتیبانی در دست راه‌اندازی است.</p>
            </div>
          </details>
        </nav>

        <SearchBox />

        <div className={styles.actions}>
          <Link href="/employer/tasks/create" className={styles.createLink}>
            <Icon name="plus" size={17} />
            <span className={styles.createLabel}>ثبت کار جدید</span>
            <span className={styles.createMobileLabel}>ثبت کار</span>
          </Link>

          <div className={styles.notificationWrap}>
            <button type="button" className={styles.roundButton}
              aria-label="اعلان‌ها" aria-expanded={notificationOpen}
              onClick={() => setNotificationOpen(!notificationOpen)}>
              <Icon name="bell" size={21} />
              <span className={styles.orangeDot} aria-hidden="true" />
            </button>
            {notificationOpen && <div className={styles.notificationPanel} role="status">
              بخش اعلان‌ها هنوز به سرویس اعلان متصل نشده است.
            </div>}
          </div>

          {user ? (
            <details className={styles.profileDetails}>
              <summary className={styles.profileButton} aria-label={`حساب ${displayName}`}>
                <span className={styles.avatar}>{avatarInitial}</span>
                <Icon name="chevron" size={14} />
              </summary>
              <div className={`${styles.dropdown} ${styles.profileDropdown}`}>
                <p className={styles.dropdownTitle}>{displayName}</p>
                {user.phone && <p className={styles.dropdownNote} dir="ltr">{user.phone}</p>}
                <button className={styles.logoutButton} type="button" onClick={logout}>
                  <Icon name="logout" size={17} /> خروج از حساب
                </button>
              </div>
            </details>
          ) : (
            <Link href="/login" className={styles.loginLink}>
              <Icon name="user" size={17} /><span>ورود</span>
            </Link>
          )}

          <button className={styles.mobileToggle} type="button"
            aria-label={mobileOpen ? "بستن منو" : "باز کردن منو"}
            aria-controls="vaka-mobile-navigation" aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}>
            <Icon name={mobileOpen ? "close" : "menu"} size={24} />
          </button>
        </div>
      </div>

      <SearchBox mobile />
      {mobileOpen && <nav className={styles.mobileNav} id="vaka-mobile-navigation" aria-label="منوی موبایل">
        <Link href="/" onClick={() => setMobileOpen(false)}>خانه</Link>
        <Link href="/employer/tasks/create" onClick={() => setMobileOpen(false)}>ثبت کار جدید</Link>
        <p>خدمات و دسته‌بندی‌ها <small>به‌زودی</small></p>
        <p>ارتباط و پشتیبانی <small>به‌زودی</small></p>
        {!user && <Link href="/register" onClick={() => setMobileOpen(false)}>ثبت‌نام</Link>}
      </nav>}
    </header>
  );
}
