"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import CoverageMap from "./CoverageMap";
import styles from "./UserSkillsPage.module.css";
import {
  addMySkill,
  deleteMySkill,
  getMySkills,
  getSkillsCatalog,
  updateMySkill,
  type SkillCatalogItem,
  type WorkerSkillLevel,
  type WorkerSkillRecord,
} from "@/lib/worker-skills-api";
import {
  createMyAvailabilitySlot,
  deleteMyAvailabilitySlot,
  getMyAvailability,
  getMyServiceArea,
  getMyWorkerPreferences,
  getTaskCategories,
  updateMyAvailabilitySlot,
  updateMyServiceArea,
  updateMyWorkerPreferences,
  type WorkerAvailabilitySlotRecord,
  type WorkerServiceAreaPayload,
  type WorkerServiceAreaRecord,
} from "@/lib/worker-profile-settings-api";

type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
type SkillIcon = "delivery" | "cleaning" | "admin" | "general";

type Skill = {
  id: string;
  skillId: string;
  title: string;
  category: string;
  level: SkillLevel;
  experienceYears: number;
  icon: SkillIcon;
};

type WorkCategory = {
  id: string;
  label: string;
  icon: "bag" | "building" | "cleaning" | "package" | "paw" | "tools";
  active: boolean;
};

type ScheduleGroup = {
  id: "weekdays" | "thursday" | "friday";
  label: string;
  dayIds: string[];
};

type ProfileSettings = {
  skills: Skill[];
};

type SkillDraft = {
  skillId: string;
  level: SkillLevel;
  experienceYears: string;
};

type IconName =
  | "settings"
  | "plus"
  | "plus-circle"
  | "edit"
  | "trash"
  | "delivery"
  | "cleaning"
  | "admin"
  | "bag"
  | "building"
  | "home"
  | "package"
  | "paw"
  | "tools"
  | "check"
  | "chevron"
  | "calendar"
  | "bolt"
  | "plane"
  | "pin"
  | "x"
  | "search"
  | "clock"
  | "check-circle"
  | "info"
  | "sliders"
  | "award"
  | "shapes"
  | "compass";

const emptyDraft: SkillDraft = {
  skillId: "",
  level: "beginner",
  experienceYears: "0",
};

function skillDraftSignature(draft: SkillDraft): string {
  return JSON.stringify({
    skillId: draft.skillId,
    level: draft.level,
    experienceYears: toLatinDigits(draft.experienceYears).trim(),
  });
}

const initialProfile: ProfileSettings = { skills: [] };

const scheduleGroups: ScheduleGroup[] = [
  { id: "weekdays", label: "شنبه تا چهارشنبه", dayIds: ["sat", "sun", "mon", "tue", "wed"] },
  { id: "thursday", label: "پنجشنبه", dayIds: ["thu"] },
  { id: "friday", label: "جمعه", dayIds: ["fri"] },
];



const levelLabels: Record<SkillLevel, string> = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  advanced: "حرفه‌ای",
  expert: "متخصص",
};

const categoryIcons: Record<WorkCategory["icon"], IconName> = {
  bag: "bag",
  building: "building",
  cleaning: "cleaning",
  package: "package",
  paw: "paw",
  tools: "tools",
};

const skillIcons: Record<SkillIcon, IconName> = {
  delivery: "delivery",
  cleaning: "cleaning",
  admin: "admin",
  general: "settings",
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    "plus-circle": <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M7 12h10" /></>,
    edit: <><path d="m15 5 4 4M4 20l4.2-.9L19 8.3a2.1 2.1 0 0 0-3-3L5.2 16.1 4 20Z" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    delivery: <><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="18" cy="18" r="1.8" /></>,
    cleaning: <><path d="m7 4 9 9M5 6l3-3M13 14l-5 6M15 12l4-4M11 18l3 3" /><path d="M4 20h8" /></>,
    admin: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.4-3.3 2.4-5 6-5s5.6 1.7 6 5M17 8h4M19 6v4M17 15c2.2.1 3.5 1.8 4 4" /></>,
    bag: <><path d="M5 8h14l1 12H4L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
    building: <><path d="M4 20V5l8-2 8 2v15M2 20h20M8 8h1M15 8h1M8 12h1M15 12h1M10 20v-4h4v4" /></>,
    home: <><path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6" /></>,
    package: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v9M8 5.2l8 4.5" /></>,
    paw: <><ellipse cx="12" cy="16" rx="5.5" ry="4" /><ellipse cx="5.5" cy="9" rx="2" ry="2.8" /><ellipse cx="10" cy="6" rx="2" ry="2.8" /><ellipse cx="15" cy="6" rx="2" ry="2.8" /><ellipse cx="19" cy="9" rx="2" ry="2.8" /></>,
    tools: <><path d="m14 6 4-3 3 3-3 4M4 20l9-9M6 5l4 4M4 7l3-3 5 5-3 3-5-5ZM14 13l6 6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7 3v4M17 3v4M3.5 9h17M8 13h3M8 17h6" /></>,
    bolt: <><path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z" /></>,
    plane: <><path d="m3 11 18-7-7 18-3-8-8-3Z" /><path d="m11 14 5-5" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    x: <><path d="m6 6 12 12M18 6 6 18" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    "check-circle": <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7h.01" /></>,
    sliders: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="15" cy="18" r="2" /></>,
    award: <><circle cx="12" cy="8" r="6" /><path d="m8.5 13-1 8 4.5-2.5 4.5 2.5-1-8M9.5 8l1.7 1.7L14.8 6" /></>,
    shapes: <><path d="M12 3 3.5 8v9h17V8L12 3Z" /><path d="M8 17v-5h8v5M12 3v4" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 5-4.8 2 2-4.8 5-2.2Z" /></>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function cloneProfile(profile: ProfileSettings): ProfileSettings {
  return { skills: profile.skills.map((skill) => ({ ...skill })) };
}

function toPersianDigits(value: string | number) {
  return String(value)
    .replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])
    .replace(/[٠-٩]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"["٠١٢٣٤٥٦٧٨٩".indexOf(digit)]);
}

function toLatinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function normalizeTimeInput(value: string) {
  const digits = toLatinDigits(value).replace(/[^0-9:]/g, "").slice(0, 5);
  if (digits.includes(":")) {
    const [hour = "", minute = ""] = digits.split(":");
    const normalizedHour = hour.length === 1 ? `0${hour}` : hour.slice(0, 2);
    return `${normalizedHour}:${minute.slice(0, 2)}`;
  }
  if (digits.length > 2) {
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }
  return digits;
}

function isValidTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function formatScheduleTime(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const period = hour < 12 ? "صبح" : hour < 17 ? "ظهر" : "عصر";
  return `${toPersianDigits(`${hourText}:${minuteText}`)} ${period}`;
}

function mapApiLevel(level: WorkerSkillLevel): SkillLevel {
  switch (level) {
    case "BEGINNER": return "beginner";
    case "INTERMEDIATE": return "intermediate";
    case "ADVANCED": return "advanced";
    case "EXPERT": return "expert";
  }
}

function mapUiLevel(level: SkillLevel): WorkerSkillLevel {
  switch (level) {
    case "beginner": return "BEGINNER";
    case "intermediate": return "INTERMEDIATE";
    case "advanced": return "ADVANCED";
    case "expert": return "EXPERT";
  }
}

function mapWorkerSkill(record: WorkerSkillRecord): Skill {
  return {
    id: record.worker_skill_id,
    skillId: record.skill.skill_id,
    title: record.skill.name,
    category: record.skill.category?.name ?? "مهارت عمومی",
    level: mapApiLevel(record.proficiency_level),
    experienceYears: record.experience_years,
    icon: "general",
  };
}

function getErrorText(error: unknown): string {
  return error instanceof Error ? error.message : "دریافت اطلاعات مهارت‌ها با خطا مواجه شد.";
}

function getCategoryIcon(name: string): WorkCategory["icon"] {
  const normalized = name.toLocaleLowerCase("fa-IR");
  if (normalized.includes("نظافت") || normalized.includes("خانه")) return "cleaning";
  if (normalized.includes("حیوان") || normalized.includes("پت")) return "paw";
  if (normalized.includes("تعمیر") || normalized.includes("فنی")) return "tools";
  if (normalized.includes("اداری") || normalized.includes("نوبت")) return "building";
  if (normalized.includes("تحویل") || normalized.includes("بسته") || normalized.includes("جابه")) return "package";
  return "bag";
}

function categorySelectionSignature(ids: string[]): string {
  return [...ids].sort().join("|");
}

function PreferredCategoriesSection() {
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const selectedIdsRef = useRef(selectedIds);
  const lastAttemptedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    let isCurrent = true;
    async function load() {
      setIsLoading(true);
      try {
        const [catalog, preferences] = await Promise.all([
          getTaskCategories(),
          getMyWorkerPreferences(),
        ]);
        if (!isCurrent) return;
        const nextCategories = catalog.map((item) => ({
          id: item.category_id,
          label: item.name,
          icon: getCategoryIcon(item.name),
          active: preferences.preferred_categories.some((saved) => saved.category_id === item.category_id),
        }));
        const nextIds = preferences.preferred_categories.map((item) => item.category_id);
        setCategories(nextCategories);
        setSelectedIds(nextIds);
        setSavedIds(nextIds);
        setError(null);
      } catch (loadError) {
        if (isCurrent) setError(getErrorText(loadError));
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }
    void load();
    return () => { isCurrent = false; };
  }, []);

  const isDirty = categorySelectionSignature(selectedIds) !== categorySelectionSignature(savedIds);

  function toggleCategory(categoryId: string) {
    lastAttemptedSignatureRef.current = null;
    setSelectedIds((previous) => previous.includes(categoryId)
      ? previous.filter((id) => id !== categoryId)
      : [...previous, categoryId]);
  }

  useEffect(() => {
    if (isLoading || error || !isDirty || isSaving) return;

    const idsToSave = [...selectedIds];
    const signature = categorySelectionSignature(idsToSave);
    if (signature === lastAttemptedSignatureRef.current) return;

    const timeout = window.setTimeout(async () => {
      if (signature === lastAttemptedSignatureRef.current) return;
      lastAttemptedSignatureRef.current = signature;
      setIsSaving(true);
      setNotice("در حال ذخیره خودکار دسته‌بندی‌ها...");

      try {
        const response = await updateMyWorkerPreferences({ preferred_category_ids: idsToSave });
        const nextIds = response.preferred_categories.map((item) => item.category_id);
        setSavedIds(nextIds);
        setCategories((previous) => previous.map((category) => ({
          ...category,
          active: nextIds.includes(category.id),
        })));

        if (categorySelectionSignature(selectedIdsRef.current) === signature) {
          setSelectedIds(nextIds);
        }
        setNotice("تغییرات دسته‌بندی‌های موردعلاقه ذخیره شد.");
      } catch (saveError) {
        setNotice(getErrorText(saveError));
      } finally {
        setIsSaving(false);
      }
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [selectedIds, savedIds, isLoading, error, isSaving, isDirty]);

  return (
    <section className={`${styles.card} ${styles.categoryCard}`} aria-labelledby="categories-title">
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleWrap}>
          <span className={styles.sectionIcon}><Icon name="shapes" size={21} /></span>
          <h2 id="categories-title">دسته‌بندی‌های کاری موردعلاقه</h2>
        </div>
        <span className={styles.helperText}>
          {isLoading
            ? "در حال دریافت..."
            : isSaving
              ? "در حال ذخیره خودکار..."
              : isDirty
                ? "تغییرات در انتظار ذخیره خودکار..."
                : "ذخیره‌سازی خودکار فعال است"}
        </span>
      </div>
      <p className={styles.sectionSubtext}>دسته‌هایی که می‌خواهید آگهی‌های آن‌ها در اولویت پیشنهادها باشند.</p>
      {notice && <div className={styles.toast} role="status">{notice}</div>}
      {isLoading ? (
        <div className={styles.emptyState}>در حال دریافت دسته‌بندی‌ها از سرور...</div>
      ) : error ? (
        <div className={styles.emptyState}><strong>دسته‌بندی‌ها دریافت نشدند.</strong><span>{error}</span></div>
      ) : categories.length === 0 ? (
        <div className={styles.emptyState}>در حال حاضر دسته‌بندی فعالی در سرور وجود ندارد.</div>
      ) : (
        <div className={styles.categoryGrid}>
          {categories.map((category) => {
            const active = selectedIds.includes(category.id);
            return (
              <button
                type="button"
                key={category.id}
                className={`${styles.categoryChip} ${active ? styles.categoryChipActive : ""}`}
                aria-pressed={active}
                onClick={() => toggleCategory(category.id)}
                disabled={isSaving}
              >
                <span className={styles.categoryIcon}><Icon name={categoryIcons[category.icon]} size={19} /></span>
                <span className={styles.categoryLabel}>{category.label}</span>
                <span className={styles.categoryCheck}>{active ? <Icon name="check" size={16} /> : <Icon name="plus" size={16} />}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

type ServiceAreaDraft = {
  city: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  locationSelected: boolean;
  coversEntireCity: boolean;
};

const emptyServiceArea: ServiceAreaDraft = {
  city: "",
  region: "",
  latitude: null,
  longitude: null,
  radiusKm: 10,
  locationSelected: false,
  coversEntireCity: false,
};

function serviceAreaFromApi(record: WorkerServiceAreaRecord): ServiceAreaDraft {
  const latitude = record.service_area_latitude === null ? null : Number(record.service_area_latitude);
  const longitude = record.service_area_longitude === null ? null : Number(record.service_area_longitude);
  const radiusKm = record.service_area_radius_km;
  const hasAnyLocationValue = latitude !== null || longitude !== null || radiusKm !== null;
  const locationSelected = latitude !== null && Number.isFinite(latitude)
    && longitude !== null && Number.isFinite(longitude)
    && radiusKm !== null && Number.isFinite(radiusKm);
  if (hasAnyLocationValue && !locationSelected) {
    throw new Error("اطلاعات نقطه مبدأ در سرور ناقص است؛ برای جلوگیری از بازنویسی ناخواسته، ویرایش محدوده متوقف شد.");
  }
  return {
    city: record.service_area_city ?? "",
    region: record.service_area_region ?? "",
    latitude: locationSelected ? latitude : null,
    longitude: locationSelected ? longitude : null,
    radiusKm: locationSelected ? radiusKm as number : 10,
    locationSelected,
    coversEntireCity: record.covers_entire_city === true,
  };
}

function serviceAreaEqual(left: ServiceAreaDraft, right: ServiceAreaDraft): boolean {
  if (left.city.trim() !== right.city.trim() || left.region.trim() !== right.region.trim()) return false;
  if (left.locationSelected !== right.locationSelected) return false;
  if (left.coversEntireCity !== right.coversEntireCity) return false;
  if (!left.locationSelected) return true;
  return left.latitude === right.latitude && left.longitude === right.longitude && left.radiusKm === right.radiusKm;
}

function serviceAreaSignature(area: ServiceAreaDraft): string {
  return JSON.stringify({
    city: area.city.trim(),
    region: area.region.trim(),
    locationSelected: area.locationSelected,
    coversEntireCity: area.coversEntireCity,
    latitude: area.locationSelected ? area.latitude : null,
    longitude: area.locationSelected ? area.longitude : null,
    radiusKm: area.locationSelected ? area.radiusKm : null,
  });
}

function ServiceAreaSection() {
  const [area, setArea] = useState<ServiceAreaDraft>(emptyServiceArea);
  const [savedArea, setSavedArea] = useState<ServiceAreaDraft>(emptyServiceArea);
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const latestAreaRef = useRef(area);
  const lastAttemptedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    latestAreaRef.current = area;
  }, [area]);

  useEffect(() => {
    let isCurrent = true;
    getMyServiceArea()
      .then((record) => {
        if (!isCurrent) return;
        const next = serviceAreaFromApi(record);
        setArea(next);
        setSavedArea(next);
        if (next.locationSelected && next.latitude !== null && next.longitude !== null) {
          setAddress(toPersianDigits(`${next.latitude.toFixed(5)} ، ${next.longitude.toFixed(5)}`));
        }
      })
      .catch((loadError) => {
        if (!isCurrent) return;

        if (process.env.NODE_ENV === "development") {
          setNotice("");
          setError(null);
        } else {
          setError(getErrorText(loadError));
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, []);

  const isDirty = !serviceAreaEqual(area, savedArea);
  const mapLatitude = area.latitude ?? 35.6892;
  const mapLongitude = area.longitude ?? 51.3890;
  const radiusMax = Math.max(35, Math.min(32767, area.radiusKm));

  const updateArea = useCallback((updater: (previous: ServiceAreaDraft) => ServiceAreaDraft) => {
    lastAttemptedSignatureRef.current = null;
    setArea(updater);
  }, []);

  const updateLocation = useCallback((
    latitude: number,
    longitude: number,
    selectedAddress: string,
    details?: { city?: string; region?: string; neighborhood?: string },
  ) => {
    updateArea((previous) => ({
      ...previous,
      latitude,
      longitude,
      locationSelected: true,
      city: details?.city || previous.city,
      region: details?.region || previous.region,
    }));
    setAddress(selectedAddress);
  }, [updateArea]);

  const persistArea = useCallback(async (snapshot: ServiceAreaDraft) => {
    const signature = serviceAreaSignature(snapshot);
    if (isSaving || signature === serviceAreaSignature(savedArea) || signature === lastAttemptedSignatureRef.current) {
      return;
    }

    if (snapshot.locationSelected && (
      snapshot.latitude === null
      || snapshot.longitude === null
      || snapshot.radiusKm < 1
      || snapshot.radiusKm > 32767
    )) {
      setNotice("نقطه مبدأ و شعاع فعالیت معتبر نیستند.");
      return;
    }

    const payload: WorkerServiceAreaPayload = {
      service_area_city: snapshot.city.trim(),
      service_area_region: snapshot.region.trim(),
      covers_entire_city: snapshot.coversEntireCity,
    };
    if (snapshot.locationSelected) {
      payload.service_area_latitude = snapshot.latitude;
      payload.service_area_longitude = snapshot.longitude;
      payload.service_area_radius_km = snapshot.radiusKm;
    } else if (savedArea.locationSelected) {
      payload.service_area_latitude = null;
      payload.service_area_longitude = null;
      payload.service_area_radius_km = null;
    }

    lastAttemptedSignatureRef.current = signature;
    setIsSaving(true);
    setNotice("در حال ذخیره خودکار محدوده جغرافیایی...");

    try {
      const response = await updateMyServiceArea(payload);
      const next = serviceAreaFromApi(response);
      setSavedArea(next);

      if (serviceAreaSignature(latestAreaRef.current) === signature) {
        setArea(next);
        if (!next.locationSelected) setAddress("");
        setNotice("تغییرات محدوده جغرافیایی ذخیره شد.");
      } else {
        setNotice("محدوده قبلی ذخیره شد؛ تغییر جدید نیز در صف ذخیره‌سازی است.");
      }
    } catch (saveError) {
      setNotice(getErrorText(saveError));
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, savedArea]);

  useEffect(() => {
    if (isLoading || error || !isDirty || isSaving) return;

    const snapshot = { ...area };
    const signature = serviceAreaSignature(snapshot);
    if (signature === lastAttemptedSignatureRef.current) return;

    const timeout = window.setTimeout(() => {
      void persistArea(snapshot);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [area, savedArea, isLoading, error, isSaving, isDirty, persistArea]);

  function clearLocation() {
    updateArea((previous) => ({
      ...previous,
      latitude: null,
      longitude: null,
      locationSelected: false,
    }));
    setAddress("");
  }

  function setCitywideCoverage(enabled: boolean) {
    updateArea((previous) => ({
      ...previous,
      city: enabled ? "تهران" : previous.city,
      region: enabled ? "استان تهران" : previous.region,
      coversEntireCity: enabled,
    }));
    if (enabled) setAddress("تهران، استان تهران، ایران");
  }

  return (
    <section className={styles.card} aria-labelledby="coverage-title">
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleWrap}>
          <span className={styles.sectionIcon}><Icon name="compass" size={21} /></span>
          <h2 id="coverage-title">محدوده جغرافیایی و مناطق تحت پوشش</h2>
        </div>
        <span className={styles.cityBadge}>{area.city.trim() || "شهر ثبت نشده"} <Icon name="pin" size={14} /></span>
      </div>
      {notice && <div className={styles.toast} role="status">{notice}</div>}
      {isLoading ? (
        <div className={styles.emptyState}>در حال دریافت محدوده جغرافیایی از سرور...</div>
      ) : error ? (
        <div className={styles.emptyState}><strong>محدوده جغرافیایی دریافت نشد.</strong><span>{error}</span></div>
      ) : (
        <>
          <div className={styles.formGrid}>
            <label className={styles.scheduleTimeField}>
              <span>شهر</span>
              <input value={area.city} onChange={(event) => updateArea((previous) => ({ ...previous, city: event.target.value }))} maxLength={100} disabled={isSaving || area.coversEntireCity} />
            </label>
            <label className={styles.scheduleTimeField}>
              <span>استان / منطقه</span>
              <input value={area.region} onChange={(event) => updateArea((previous) => ({ ...previous, region: event.target.value }))} maxLength={120} disabled={isSaving || area.coversEntireCity} />
            </label>
          </div>
          <div className={styles.areaSection}>
            <div className={styles.areaHeading}>
              <span>نقطه مبدأ فعالیت:</span>
              {area.locationSelected && !area.coversEntireCity ? (
                <button type="button" className={styles.secondaryButton} onClick={clearLocation} disabled={isSaving}>حذف نقطه مبدأ</button>
              ) : <span className={styles.helperText}>{area.coversEntireCity ? "مرز کل شهر تهران انتخاب شده است." : "برای ثبت مبدأ، روی نقشه انتخاب کنید."}</span>}
            </div>
            <CoverageMap
              latitude={mapLatitude}
              longitude={mapLongitude}
              radiusMeters={area.radiusKm * 1000}
              locationSelected={area.locationSelected}
              coversEntireCity={area.coversEntireCity}
              addressValue={address}
              onLocationChange={updateLocation}
            />
            <p className={styles.sectionSubtext}>
              {area.coversEntireCity
                ? "تمام محدوده شهر تهران انتخاب شده است."
                : area.locationSelected
                  ? (address || "مختصات نقطه مبدأ انتخاب شده است.")
                  : "هنوز نقطه مبدأیی ثبت نشده است؛ می‌توانید محله یا آدرس را جست‌وجو کنید."}
            </p>
          </div>
          <label className={styles.citywideRow}>
            <span className={styles.citywideIcon}><Icon name="pin" size={19} /></span>
            <span className={styles.citywideCopy}>
              <strong>پذیرش کارهای سراسر تهران</strong>
              <span>با فعال‌سازی، محدوده کل شهر تهران انتخاب می‌شود و شعاع نقطه‌ای غیرفعال خواهد شد.</span>
            </span>
            <input
              className={styles.citywideCheckbox}
              type="checkbox"
              checked={area.coversEntireCity}
              onChange={(event) => setCitywideCoverage(event.target.checked)}
              disabled={isSaving}
              aria-label="پذیرش کارهای سراسر تهران"
            />
            <span className={styles.citywideSwitch} aria-hidden="true" />
          </label>
          <div className={styles.radiusSection}>
            <div className={styles.radiusHeading}>
              <label htmlFor="coverage-radius">شعاع جغرافیایی مجاز برای انجام کار:</label>
              <strong>تا {toPersianDigits(area.radiusKm)} کیلومتر از مبدأ</strong>
            </div>
            <input
              id="coverage-radius"
              className={styles.rangeInput}
              type="range"
              min={1}
              max={radiusMax}
              step={1}
              value={area.radiusKm}
              onChange={(event) => updateArea((previous) => ({ ...previous, radiusKm: Number(event.target.value) }))}
              disabled={!area.locationSelected || area.coversEntireCity || isSaving}
              aria-valuetext={`${toPersianDigits(area.radiusKm)} کیلومتر`}
            />
            <div
              className={styles.rangeLabels}
              style={{ "--ten-position": `${((10 - 1) / (radiusMax - 1)) * 100}%` } as CSSProperties}
            >
              <span>۱ کیلومتر</span><span>۱۰ کیلومتر</span><span>حداکثر {toPersianDigits(radiusMax)} کیلومتر</span>
            </div>
          </div>
          <p className={styles.helperText}>
            {isSaving
              ? "در حال ذخیره خودکار..."
              : isDirty
                ? "تغییرات در انتظار ذخیره خودکار..."
                : "تغییرات این بخش به‌صورت خودکار ذخیره می‌شوند."}
          </p>
        </>
      )}
    </section>
  );
}

type AvailabilityDay = { id: string; label: string; weekday: number };
type AvailabilityUiSlot = { availabilityId: string; weekday: number; from: string; to: string };
type AvailabilityDraftSlot = { availabilityId: string | null; from: string; to: string };
type AvailabilityDraftDay = { enabled: boolean; slots: AvailabilityDraftSlot[] };
type AvailabilityDraft = Record<string, AvailabilityDraftDay>;

const availabilityDays: AvailabilityDay[] = [
  { id: "sat", label: "شنبه", weekday: 0 },
  { id: "sun", label: "یکشنبه", weekday: 1 },
  { id: "mon", label: "دوشنبه", weekday: 2 },
  { id: "tue", label: "سه‌شنبه", weekday: 3 },
  { id: "wed", label: "چهارشنبه", weekday: 4 },
  { id: "thu", label: "پنجشنبه", weekday: 5 },
  { id: "fri", label: "جمعه", weekday: 6 },
];

function availabilitySlotsFromApi(records: WorkerAvailabilitySlotRecord[]): AvailabilityUiSlot[] {
  return records.map((record) => ({
    availabilityId: record.availability_id,
    weekday: record.weekday,
    from: normalizeTimeInput(record.start_time.slice(0, 5)),
    to: normalizeTimeInput(record.end_time.slice(0, 5)),
  }));
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function getScheduleGroupTitle(group: ScheduleGroup, activeDays: AvailabilityDay[]): string {
  if (activeDays.length === 0) return group.label;
  if (group.id === "weekdays" && activeDays.length === 5) return "شنبه تا چهارشنبه";
  if (activeDays.length === 1) return activeDays[0].label;
  return activeDays.map((day) => day.label).join("، ");
}

function getAvailabilityDraftError(group: ScheduleGroup, draft: AvailabilityDraft): string | null {
  for (const dayId of group.dayIds) {
    const draftDay = draft[dayId];
    if (!draftDay?.enabled) continue;
    if (draftDay.slots.length === 0) {
      return "برای روز فعال، حداقل یک بازه زمانی اضافه کنید.";
    }

    const ordered = [...draftDay.slots].sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from));
    for (let index = 0; index < ordered.length; index += 1) {
      const slot = ordered[index];
      if (!isValidTime(slot.from) || !isValidTime(slot.to) || slot.from >= slot.to) {
        return "ساعت شروع و پایان هر بازه باید معتبر باشد و پایان بعد از شروع قرار بگیرد.";
      }
      if (index > 0 && timeToMinutes(slot.from) < timeToMinutes(ordered[index - 1].to)) {
        return "بازه‌های یک روز نباید با یکدیگر هم‌پوشانی داشته باشند.";
      }
    }
  }
  return null;
}

function availabilityDraftFromSlots(
  group: ScheduleGroup,
  slots: AvailabilityUiSlot[],
): AvailabilityDraft {
  const draft: AvailabilityDraft = {};
  for (const dayId of group.dayIds) {
    const day = availabilityDays.find((item) => item.id === dayId);
    if (!day) continue;
    const daySlots = slots.filter((slot) => slot.weekday === day.weekday);
    draft[dayId] = {
      enabled: daySlots.length > 0,
      slots: daySlots.map((slot) => ({
        availabilityId: slot.availabilityId,
        from: slot.from,
        to: slot.to,
      })),
    };
  }
  return draft;
}

function AvailabilitySection() {
  const [slots, setSlots] = useState<AvailabilityUiSlot[]>([]);
  const [timezone, setTimezone] = useState("UTC");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [scheduleEditorGroup, setScheduleEditorGroup] = useState<ScheduleGroup | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<AvailabilityDraft>({});
  const [savedDraftSignature, setSavedDraftSignature] = useState<string | null>(null);
  const savedDraftSignatureRef = useRef<string | null>(null);
  const lastAttemptedDraftSignatureRef = useRef<string | null>(null);
  const closeAfterSaveRef = useRef(false);

  const updateSavedDraftSignature = useCallback((signature: string) => {
    savedDraftSignatureRef.current = signature;
    setSavedDraftSignature(signature);
  }, []);

  const scheduleValidationError = scheduleEditorGroup
    ? getAvailabilityDraftError(scheduleEditorGroup, scheduleDraft)
    : null;

  useEffect(() => {
    let isCurrent = true;
    getMyAvailability()
      .then((response) => {
        if (!isCurrent) return;
        setTimezone(response.availability_timezone || "UTC");
        setSlots(availabilitySlotsFromApi(response.slots));
      })
      .catch((loadError) => {
        if (isCurrent) setError(getErrorText(loadError));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, []);

  function openScheduleEditor(group: ScheduleGroup) {
    const nextDraft = availabilityDraftFromSlots(group, slots);
    setScheduleDraft(nextDraft);
    updateSavedDraftSignature(JSON.stringify(nextDraft));
    lastAttemptedDraftSignatureRef.current = null;
    closeAfterSaveRef.current = false;
    setScheduleEditorGroup(group);
    setNotice("");
  }

  function updateScheduleDraft(updater: (previous: AvailabilityDraft) => AvailabilityDraft) {
    lastAttemptedDraftSignatureRef.current = null;
    setScheduleDraft(updater);
    setNotice("تغییرات پس از توقف ویرایش به‌صورت خودکار ذخیره می‌شوند.");
  }

  function toggleDraftDay(dayId: string) {
    updateScheduleDraft((previous) => {
      const current = previous[dayId];
      if (!current) return previous;
      return {
        ...previous,
        [dayId]: {
          ...current,
          enabled: !current.enabled,
          slots: !current.enabled && current.slots.length === 0
            ? [{ availabilityId: null, from: "09:00", to: "18:00" }]
            : current.slots,
        },
      };
    });
  }

  function updateDraftSlot(dayId: string, index: number, field: "from" | "to", value: string) {
    updateScheduleDraft((previous) => ({
      ...previous,
      [dayId]: {
        ...previous[dayId],
        slots: previous[dayId].slots.map((slot, slotIndex) => slotIndex === index
          ? { ...slot, [field]: normalizeTimeInput(value) }
          : slot),
      },
    }));
  }

  function addDraftSlot(dayId: string) {
    updateScheduleDraft((previous) => ({
      ...previous,
      [dayId]: {
        ...previous[dayId],
        enabled: true,
        slots: [...previous[dayId].slots, { availabilityId: null, from: "14:00", to: "18:00" }],
      },
    }));
  }

  function removeDraftSlot(dayId: string, index: number) {
    updateScheduleDraft((previous) => ({
      ...previous,
      [dayId]: {
        ...previous[dayId],
        slots: previous[dayId].slots.filter((_, slotIndex) => slotIndex !== index),
      },
    }));
  }

  const persistScheduleGroup = useCallback(async (
    group: ScheduleGroup,
    draftSnapshot: AvailabilityDraft,
    baselineSlots: AvailabilityUiSlot[],
  ) => {
    if (isSaving) return;

    const validationError = getAvailabilityDraftError(group, draftSnapshot);
    if (validationError) {
      setNotice(validationError);
      return;
    }

    const signature = JSON.stringify(draftSnapshot);
    if (signature === savedDraftSignatureRef.current || signature === lastAttemptedDraftSignatureRef.current) {
      return;
    }

    lastAttemptedDraftSignatureRef.current = signature;
    setIsSaving(true);
    setNotice("در حال ذخیره خودکار برنامه کاری...");

    try {
      for (const dayId of group.dayIds) {
        const day = availabilityDays.find((item) => item.id === dayId);
        const draftDay = draftSnapshot[dayId];
        if (!day || !draftDay) continue;

        const oldSlots = baselineSlots.filter((slot) => slot.weekday === day.weekday);
        const desiredSlots = draftDay.enabled ? draftDay.slots : [];
        const retainedIds = new Set(desiredSlots.flatMap((slot) => slot.availabilityId ? [slot.availabilityId] : []));
        const removedSlots = oldSlots.filter((slot) => !retainedIds.has(slot.availabilityId));

        for (const slot of removedSlots) {
          await deleteMyAvailabilitySlot(slot.availabilityId);
        }

        for (const slot of desiredSlots) {
          if (!slot.availabilityId) continue;
          const old = oldSlots.find((item) => item.availabilityId === slot.availabilityId);
          if (old && (old.from !== slot.from || old.to !== slot.to)) {
            await updateMyAvailabilitySlot(slot.availabilityId, {
              weekday: day.weekday,
              start_time: slot.from,
              end_time: slot.to,
            });
          }
        }

        for (const slot of desiredSlots) {
          if (slot.availabilityId) continue;
          await createMyAvailabilitySlot({
            weekday: day.weekday,
            start_time: slot.from,
            end_time: slot.to,
          });
        }
      }

      const refreshed = await getMyAvailability();
      const refreshedSlots = availabilitySlotsFromApi(refreshed.slots);
      const normalizedDraft = availabilityDraftFromSlots(group, refreshedSlots);
      setTimezone(refreshed.availability_timezone || "UTC");
      setSlots(refreshedSlots);
      setScheduleDraft(normalizedDraft);
      updateSavedDraftSignature(JSON.stringify(normalizedDraft));
      lastAttemptedDraftSignatureRef.current = JSON.stringify(normalizedDraft);
      setNotice("تغییرات برنامه کاری به‌صورت خودکار ذخیره شد.");

      if (closeAfterSaveRef.current) {
        setScheduleEditorGroup(null);
        closeAfterSaveRef.current = false;
      }
    } catch (saveError) {
      let refreshedSuccessfully = false;
      try {
        const refreshed = await getMyAvailability();
        const refreshedSlots = availabilitySlotsFromApi(refreshed.slots);
        const refreshedDraft = availabilityDraftFromSlots(group, refreshedSlots);
        setTimezone(refreshed.availability_timezone || "UTC");
        setSlots(refreshedSlots);
        setScheduleDraft(refreshedDraft);
        updateSavedDraftSignature(JSON.stringify(refreshedDraft));
        lastAttemptedDraftSignatureRef.current = JSON.stringify(refreshedDraft);
        refreshedSuccessfully = true;
      } catch {
        // Keep the original API error visible; a later page refresh can reload the schedule.
      }

      if (!refreshedSuccessfully || closeAfterSaveRef.current) {
        setScheduleEditorGroup(null);
      }
      closeAfterSaveRef.current = false;
      setNotice(refreshedSuccessfully
        ? `${getErrorText(saveError)} وضعیت فعلی برنامه از سرور دریافت شد؛ در صورت نیاز تغییرات را دوباره اعمال کنید.`
        : `${getErrorText(saveError)} دریافت دوباره برنامه از سرور نیز ناموفق بود.`);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, updateSavedDraftSignature]);

  useEffect(() => {
    if (!scheduleEditorGroup || isLoading || error || isSaving) return;

    const signature = JSON.stringify(scheduleDraft);
    if (signature === savedDraftSignatureRef.current || signature === lastAttemptedDraftSignatureRef.current) {
      return;
    }

    if (scheduleValidationError) return;

    const draftSnapshot = scheduleDraft;
    const baselineSlots = slots;
    const timeout = window.setTimeout(() => {
      void persistScheduleGroup(scheduleEditorGroup, draftSnapshot, baselineSlots);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [scheduleEditorGroup, scheduleDraft, slots, isLoading, error, isSaving, persistScheduleGroup, scheduleValidationError]);

  function closeScheduleEditor() {
    if (!scheduleEditorGroup || isSaving) return;

    const signature = JSON.stringify(scheduleDraft);
    if (signature === savedDraftSignatureRef.current) {
      setScheduleEditorGroup(null);
      return;
    }

    const validationError = getAvailabilityDraftError(scheduleEditorGroup, scheduleDraft);
    if (validationError) {
      const discard = window.confirm(`${validationError} پنجره بدون ذخیره این تغییرات بسته شود؟`);
      if (discard) {
        setScheduleEditorGroup(null);
        closeAfterSaveRef.current = false;
      } else {
        setNotice(validationError);
      }
      return;
    }

    closeAfterSaveRef.current = true;
    lastAttemptedDraftSignatureRef.current = null;
    void persistScheduleGroup(scheduleEditorGroup, scheduleDraft, slots);
  }

  return (
    <section className={styles.card} aria-labelledby="availability-title">
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleWrap}>
          <span className={styles.sectionIcon}><Icon name="calendar" /></span>
          <div>
            <h2 id="availability-title">زمان‌های در دسترس بودن و تقویم کاری</h2>
            <p className={styles.sectionSubtext}>مدیریت روزها و چند بازه زمانی در هر روز</p>
          </div>
        </div>
        <span className={styles.activeHoursBadge}><span aria-hidden="true" />{isLoading ? "در حال دریافت" : "ذخیره‌سازی خودکار فعال است"}</span>
      </div>
      {notice && <div className={styles.toast} role="status">{notice}</div>}
      {isLoading ? (
        <div className={styles.emptyState}>در حال دریافت برنامه کاری از سرور...</div>
      ) : error ? (
        <div className={styles.emptyState}><strong>برنامه کاری دریافت نشد.</strong><span>{error}</span></div>
      ) : (
        <>
          <p className={styles.sectionSubtext}>منطقه زمانی ثبت‌شده: {timezone}</p>
          <div className={styles.scheduleList}>
            {scheduleGroups.map((group) => {
              const groupDays = group.dayIds
                .map((dayId) => availabilityDays.find((day) => day.id === dayId))
                .filter((day): day is AvailabilityDay => Boolean(day));
              const activeDays = groupDays.filter((day) => slots.some((slot) => slot.weekday === day.weekday));
              const groupSlots = groupDays.map((day) => slots.filter((slot) => slot.weekday === day.weekday));
              const allDisabled = activeDays.length === 0;
              const hasMultiple = groupSlots.some((daySlots) => daySlots.length > 1);
              const allSingle = groupSlots.every((daySlots) => daySlots.length === 1);
              const firstSlot = groupSlots.find((daySlots) => daySlots.length > 0)?.[0];
              const sameHours = allSingle && groupSlots.every((daySlots) => daySlots[0]?.from === firstSlot?.from && daySlots[0]?.to === firstSlot?.to);
              const title = getScheduleGroupTitle(group, activeDays);
              const timeText = allDisabled
                ? "تعطیل و استراحت هفتگی"
                : hasMultiple
                  ? "چند بازه زمانی در روز"
                  : sameHours && firstSlot
                    ? `از ${formatScheduleTime(firstSlot.from)} الی ${formatScheduleTime(firstSlot.to)}`
                    : "بازه‌های زمانی متفاوت";
              return (
                <button
                  type="button"
                  key={group.id}
                  className={`${styles.scheduleRow} ${allDisabled ? styles.scheduleRowDisabled : ""}`}
                  onClick={() => openScheduleEditor(group)}
                  aria-label={`ویرایش برنامه ${title}`}
                  disabled={isSaving}
                >
                  <span className={styles.scheduleIcon}><Icon name="calendar" size={19} /></span>
                  <strong className={styles.dayName}>{title}</strong>
                  <span className={`${styles.scheduleTime} ${allDisabled ? styles.offDayText : ""}`}>{timeText}</span>
                  <span className={`${styles.scheduleStatus} ${allDisabled ? styles.scheduleStatusRest : ""}`}>
                    {allDisabled ? "استراحت" : hasMultiple ? "چندبازه" : activeDays.length === groupDays.length ? "فعال" : "ترکیبی"}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {scheduleEditorGroup && (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="schedule-modal-title">ویرایش زمان {scheduleEditorGroup.label}</h2>
                <p>برای هر روز می‌توانید یک یا چند بازه بدون هم‌پوشانی تعریف کنید. تغییرات پس از توقف ویرایش خودکار ذخیره می‌شوند.</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={closeScheduleEditor} aria-label="بستن پنجره" disabled={isSaving}><Icon name="x" /></button>
            </div>
            <div className={styles.scheduleEditorList}>
              {scheduleEditorGroup.dayIds.map((dayId) => {
                const day = availabilityDays.find((item) => item.id === dayId);
                const draftDay = scheduleDraft[dayId];
                if (!day || !draftDay) return null;
                return (
                  <div className={styles.scheduleEditorDayBlock} key={dayId}>
                    <label className={styles.scheduleEditorDay}>
                      <input type="checkbox" checked={draftDay.enabled} onChange={() => toggleDraftDay(dayId)} disabled={isSaving} />
                      <strong>{day.label}</strong>
                    </label>
                    {draftDay.enabled && (
                      <div className={styles.scheduleSlotList}>
                        {draftDay.slots.map((slot, index) => (
                          <div className={styles.scheduleSlotRow} key={slot.availabilityId ?? `${dayId}-${index}`}>
                            <label className={styles.scheduleTimeField}>
                              <span>شروع بازه {toPersianDigits(index + 1)}</span>
                              <input type="text" inputMode="numeric" dir="ltr" maxLength={5} value={toPersianDigits(slot.from)} onChange={(event) => updateDraftSlot(dayId, index, "from", event.target.value)} disabled={isSaving} />
                            </label>
                            <label className={styles.scheduleTimeField}>
                              <span>پایان بازه {toPersianDigits(index + 1)}</span>
                              <input type="text" inputMode="numeric" dir="ltr" maxLength={5} value={toPersianDigits(slot.to)} onChange={(event) => updateDraftSlot(dayId, index, "to", event.target.value)} disabled={isSaving} />
                            </label>
                            <button type="button" className={styles.iconButton} onClick={() => removeDraftSlot(dayId, index)} aria-label={`حذف بازه ${index + 1} ${day.label}`} disabled={isSaving}><Icon name="trash" size={16} /></button>
                          </div>
                        ))}
                        <button type="button" className={styles.addAreaButton} onClick={() => addDraftSlot(dayId)} disabled={isSaving}><Icon name="plus" size={14} /> افزودن بازه زمانی</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {scheduleValidationError && (
              <div className={styles.toast} role="alert">{scheduleValidationError}</div>
            )}
            <div className={styles.modalActions}>
              <span className={styles.helperText}>
                {isSaving
                  ? "در حال ذخیره خودکار..."
                  : JSON.stringify(scheduleDraft) !== savedDraftSignature
                    ? "تغییرات در انتظار ذخیره خودکار..."
                    : "ذخیره‌سازی خودکار فعال است."}
              </span>
              <button type="button" className={styles.secondaryButton} onClick={closeScheduleEditor} disabled={isSaving}>بستن</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default function UserSkillsPage() {
  const [profile, setProfile] = useState<ProfileSettings>(() => cloneProfile(initialProfile));
  const [skillCatalog, setSkillCatalog] = useState<SkillCatalogItem[]>([]);
  const [isSkillsLoading, setIsSkillsLoading] = useState(true);
  const [skillProfileLoadError, setSkillProfileLoadError] = useState<string | null>(null);
  const [isSkillSaving, setIsSkillSaving] = useState(false);
  const [isSkillDraftTouched, setIsSkillDraftTouched] = useState(false);
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SkillDraft>(emptyDraft);
  const lastSavedSkillDraftSignatureRef = useRef<string | null>(null);
  const lastAttemptedSkillDraftSignatureRef = useRef<string | null>(null);
  const closeSkillModalAfterSaveRef = useRef(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadSkillData() {
      setIsSkillsLoading(true);
      const errors: string[] = [];

      try {
        const catalog = await getSkillsCatalog();
        if (isCurrent) setSkillCatalog(catalog);
      } catch (error) {
        errors.push(`فهرست مهارت‌ها: ${getErrorText(error)}`);
      }

      try {
        const records = await getMySkills();
        if (isCurrent) {
          setProfile({ skills: records.map(mapWorkerSkill) });
          setSkillProfileLoadError(null);
        }
      } catch (error) {
        const message = getErrorText(error);
        errors.push(`مهارت‌های ثبت‌شده: ${message}`);
        if (isCurrent) setSkillProfileLoadError(message);
      }

      if (isCurrent) {
        if (errors.length) setToast((previous) => [previous, errors.join(" ")].filter(Boolean).join(" "));
        setIsSkillsLoading(false);
      }
    }

    void loadSkillData();
    return () => { isCurrent = false; };
  }, []);

  const selectedCatalogSkill = skillCatalog.find((item) => item.skill_id === draft.skillId);
  const selectedSkillCategory = selectedCatalogSkill?.category_name
    ?? profile.skills.find((skill) => skill.skillId === draft.skillId)?.category
    ?? "عمومی / بدون دسته‌بندی";
  function showToast(message: string) {
    setToast(message);
  }

  function resetSkillModal() {
    setModalOpen(false);
    setEditingSkillId(null);
    setDraft(emptyDraft);
    setIsSkillDraftTouched(false);
    lastSavedSkillDraftSignatureRef.current = null;
    lastAttemptedSkillDraftSignatureRef.current = null;
    closeSkillModalAfterSaveRef.current = false;
  }

  function openAddSkill() {
    if (isSkillsLoading || skillProfileLoadError || skillCatalog.length === 0) {
      showToast("ابتدا باید فهرست مهارت‌ها و اطلاعات حساب از سرور دریافت شوند.");
      return;
    }
    const nextDraft = { ...emptyDraft, skillId: "" };
    setEditingSkillId(null);
    setDraft(nextDraft);
    setIsSkillDraftTouched(false);
    lastSavedSkillDraftSignatureRef.current = null;
    lastAttemptedSkillDraftSignatureRef.current = null;
    closeSkillModalAfterSaveRef.current = false;
    setModalOpen(true);
  }

  function openEditSkill(skill: Skill) {
    const nextDraft = {
      skillId: skill.skillId,
      level: skill.level,
      experienceYears: String(skill.experienceYears),
    };
    setEditingSkillId(skill.id);
    setDraft(nextDraft);
    setIsSkillDraftTouched(false);
    lastSavedSkillDraftSignatureRef.current = skillDraftSignature(nextDraft);
    lastAttemptedSkillDraftSignatureRef.current = null;
    closeSkillModalAfterSaveRef.current = false;
    setModalOpen(true);
  }

  function updateSkillDraft(updater: (previous: SkillDraft) => SkillDraft) {
    lastAttemptedSkillDraftSignatureRef.current = null;
    setIsSkillDraftTouched(true);
    setDraft(updater);
  }

  const persistSkillDraft = useCallback(async (
    draftSnapshot: SkillDraft,
    targetEditingSkillId: string | null,
  ) => {
    if (isSkillSaving) return;

    const experienceYears = Number(toLatinDigits(draftSnapshot.experienceYears));
    if (
      !draftSnapshot.skillId
      || !Number.isInteger(experienceYears)
      || experienceYears < 0
      || experienceYears > 60
    ) {
      setToast("مهارت و سابقه کار معتبر (بین صفر تا ۶۰ سال) را انتخاب کنید.");
      return;
    }

    const signature = skillDraftSignature(draftSnapshot);
    if (
      signature === lastSavedSkillDraftSignatureRef.current
      || signature === lastAttemptedSkillDraftSignatureRef.current
    ) {
      return;
    }

    lastAttemptedSkillDraftSignatureRef.current = signature;
    setIsSkillSaving(true);
    setToast("در حال ذخیره خودکار مهارت...");

    try {
      const payload = {
        proficiency_level: mapUiLevel(draftSnapshot.level),
        experience_years: experienceYears,
      };
      const record = targetEditingSkillId
        ? await updateMySkill(targetEditingSkillId, payload)
        : await addMySkill({ skill_id: draftSnapshot.skillId, ...payload });
      const savedSkill = mapWorkerSkill(record);
      const normalizedDraft: SkillDraft = {
        skillId: record.skill.skill_id,
        level: mapApiLevel(record.proficiency_level),
        experienceYears: String(record.experience_years),
      };
      const normalizedSignature = skillDraftSignature(normalizedDraft);

      setProfile((previous) => {
        const alreadyExists = previous.skills.some((skill) => skill.id === savedSkill.id);
        return {
          ...previous,
          skills: alreadyExists
            ? previous.skills.map((skill) => skill.id === savedSkill.id ? savedSkill : skill)
            : [...previous.skills, savedSkill],
        };
      });

      lastSavedSkillDraftSignatureRef.current = normalizedSignature;
      lastAttemptedSkillDraftSignatureRef.current = normalizedSignature;
      setDraft(normalizedDraft);
      setIsSkillDraftTouched(false);
      if (!targetEditingSkillId) setEditingSkillId(record.worker_skill_id);

      setToast(targetEditingSkillId
        ? "تغییرات مهارت به‌صورت خودکار ذخیره شد."
        : "مهارت به‌صورت خودکار در حساب شما ثبت شد.");

      if (closeSkillModalAfterSaveRef.current) {
        setModalOpen(false);
        setEditingSkillId(null);
        setDraft(emptyDraft);
        setIsSkillDraftTouched(false);
        lastSavedSkillDraftSignatureRef.current = null;
        lastAttemptedSkillDraftSignatureRef.current = null;
        closeSkillModalAfterSaveRef.current = false;
      }
    } catch (saveError) {
      setToast(getErrorText(saveError));
      if (closeSkillModalAfterSaveRef.current) {
        setModalOpen(false);
        setEditingSkillId(null);
        setDraft(emptyDraft);
        setIsSkillDraftTouched(false);
        lastSavedSkillDraftSignatureRef.current = null;
        lastAttemptedSkillDraftSignatureRef.current = null;
        closeSkillModalAfterSaveRef.current = false;
      }
    } finally {
      setIsSkillSaving(false);
    }
  }, [isSkillSaving]);

  useEffect(() => {
    if (
      !modalOpen
      || !isSkillDraftTouched
      || isSkillsLoading
      || skillProfileLoadError
      || isSkillSaving
    ) {
      return;
    }

    const signature = skillDraftSignature(draft);
    if (
      signature === lastSavedSkillDraftSignatureRef.current
      || signature === lastAttemptedSkillDraftSignatureRef.current
    ) {
      return;
    }

    const draftSnapshot = { ...draft };
    const timeout = window.setTimeout(() => {
      void persistSkillDraft(draftSnapshot, editingSkillId);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [
    modalOpen,
    isSkillDraftTouched,
    isSkillsLoading,
    skillProfileLoadError,
    isSkillSaving,
    draft,
    editingSkillId,
    persistSkillDraft,
  ]);

  function closeSkillModal() {
    if (isSkillSaving) return;

    if (!isSkillDraftTouched || skillDraftSignature(draft) === lastSavedSkillDraftSignatureRef.current) {
      resetSkillModal();
      return;
    }

    const experienceYears = Number(toLatinDigits(draft.experienceYears));
    if (
      !draft.skillId
      || !Number.isInteger(experienceYears)
      || experienceYears < 0
      || experienceYears > 60
    ) {
      const discard = window.confirm("اطلاعات مهارت کامل یا معتبر نیست. پنجره بدون ذخیره این تغییرات بسته شود؟");
      if (discard) resetSkillModal();
      else showToast("برای ذخیره خودکار، مهارت و سابقه کار معتبر را وارد کنید.");
      return;
    }

    closeSkillModalAfterSaveRef.current = true;
    lastAttemptedSkillDraftSignatureRef.current = null;
    void persistSkillDraft(draft, editingSkillId);
  }

  async function deleteSkill(skill: Skill) {
    if (!window.confirm(`مهارت «${skill.title}» از فهرست حذف شود؟`)) return;
    if (isSkillSaving) return;

    setIsSkillSaving(true);
    try {
      await deleteMySkill(skill.id);
      setProfile((previous) => ({
        ...previous,
        skills: previous.skills.filter((item) => item.id !== skill.id),
      }));
      showToast("مهارت با موفقیت از سرور حذف شد.");
    } catch (error) {
      showToast(getErrorText(error));
    } finally {
      setIsSkillSaving(false);
    }
  }

  return (
    <>
      <div className={styles.contentStack}>
        <section className={`${styles.card} ${styles.pageHeading}`}>
          <div className={styles.headingCopy}>
            <span className={styles.headingIcon}><Icon name="sliders" size={20} /></span>
            <h1>مدیریت مهارت‌ها و شرایط کاری مجری</h1>
          </div>
          <span className={styles.helperText}>تغییرات هر بخش پس از توقف ویرایش، به‌صورت خودکار در حساب شما ذخیره می‌شود.</span>
        </section>

        {toast && (
          <div className={styles.toast} role="status">
            <Icon name="info" size={17} />
            <span>{toast}</span>
            <button type="button" onClick={() => setToast("")} aria-label="بستن پیام"><Icon name="x" size={15} /></button>
          </div>
        )}

        <section className={styles.card} aria-labelledby="skills-title">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleWrap}>
              <span className={styles.sectionIcon}><Icon name="award" size={21} /></span>
              <h2 id="skills-title">مهارت‌های ثبت‌شده من</h2>
              <span className={styles.countBadge}>{toPersianDigits(profile.skills.length.toLocaleString("fa-IR"))} مهارت ثبت‌شده</span>
            </div>
            <button
              type="button"
              className={styles.addButton}
              onClick={openAddSkill}
              disabled={isSkillsLoading || Boolean(skillProfileLoadError) || skillCatalog.length === 0}
            >
              <Icon name="plus-circle" size={19} /> افزودن مهارت جدید
            </button>
          </div>

          {isSkillsLoading ? (
            <div className={styles.emptyState}><span>در حال دریافت مهارت‌ها از سرور...</span></div>
          ) : skillProfileLoadError ? (
            <div className={styles.emptyState}>
              <strong>مهارت‌های حساب دریافت نشد.</strong>
              <span>{skillProfileLoadError}</span>
              <span>برای جلوگیری از نمایش اطلاعات نادرست، افزودن یا حذف مهارت تا دریافت موفق اطلاعات غیرفعال است.</span>
            </div>
          ) : profile.skills.length > 0 ? (
            <div className={styles.skillList}>
              {profile.skills.map((skill) => (
                <article className={styles.skillRow} key={skill.id}>
                  <span className={`${styles.skillIcon} ${skill.icon === "cleaning" ? styles.skillIconWarm : skill.icon === "admin" ? styles.skillIconSoft : ""}`}>
                    <Icon name={skillIcons[skill.icon]} size={20} />
                  </span>
                  <div className={styles.skillInfo}>
                    <div className={styles.skillTitleLine}>
                      <h3>{skill.title}</h3>
                      <span className={`${styles.levelBadge} ${skill.level === "advanced" ? styles.levelAdvanced : ""}`}>
                        سطح: {levelLabels[skill.level]}
                      </span>
                    </div>
                    <div className={styles.skillMeta}>
                      <span className={styles.completedMeta}>
                        <Icon name="check-circle" size={13} />
                        سابقه کار: {toPersianDigits(skill.experienceYears)} سال
                      </span>
                      <span className={styles.metaDot} aria-hidden="true">•</span>
                      <span className={styles.rateMeta}>دسته‌بندی: <strong>{skill.category}</strong></span>
                    </div>
                  </div>
                  <div className={styles.skillActions}>
                    <button type="button" className={styles.iconButton} onClick={() => openEditSkill(skill)} aria-label={`ویرایش مهارت ${skill.title}`} title="ویرایش مهارت" disabled={isSkillSaving}>
                      <Icon name="edit" size={18} />
                    </button>
                    <button type="button" className={styles.iconButton} onClick={() => deleteSkill(skill)} aria-label={`حذف مهارت ${skill.title}`} title="حذف مهارت" disabled={isSkillSaving}>
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Icon name="settings" size={24} />
              <strong>هنوز مهارتی ثبت نکرده‌اید.</strong>
              <span>با افزودن مهارت، کارفرماها راحت‌تر شما را پیدا می‌کنند.</span>
              <button type="button" className={styles.addButton} onClick={openAddSkill} disabled={skillCatalog.length === 0}>
                <Icon name="plus" size={15} /> افزودن اولین مهارت
              </button>
            </div>
          )}
        </section>

        <PreferredCategoriesSection />

        <ServiceAreaSection />

        <AvailabilitySection />
      </div>

      {modalOpen && (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="skill-modal-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="skill-modal-title">{editingSkillId ? "ویرایش مهارت" : "افزودن مهارت جدید"}</h2>
                <p>مهارت را از فهرست موجود انتخاب کنید و سطح و سابقه کار را مشخص کنید.</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={closeSkillModal} aria-label="بستن پنجره" disabled={isSkillSaving}><Icon name="x" /></button>
            </div>
            <div className={styles.skillForm}>
              <label>
                <span>عنوان مهارت</span>
                <select
                  value={draft.skillId}
                  onChange={(event) => updateSkillDraft((previous) => ({ ...previous, skillId: event.target.value }))}
                  disabled={Boolean(editingSkillId) || isSkillSaving || isSkillsLoading}
                  required
                >
                  <option value="">انتخاب مهارت از فهرست سرور</option>
                  {skillCatalog.map((item) => (
                    <option value={item.skill_id} key={item.skill_id}>
                      {item.name}{item.category_name ? ` — ${item.category_name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>دسته‌بندی مهارت</span>
                <input value={selectedSkillCategory} readOnly />
              </label>
              <div className={styles.formGrid}>
                <label>
                  <span>سطح مهارت</span>
                  <select
                    value={draft.level}
                    onChange={(event) => updateSkillDraft((previous) => ({ ...previous, level: event.target.value as SkillLevel }))}
                    disabled={isSkillSaving}
                  >
                    <option value="beginner">مبتدی</option>
                    <option value="intermediate">متوسط</option>
                    <option value="advanced">حرفه‌ای</option>
                    <option value="expert">متخصص</option>
                  </select>
                </label>
                <label>
                  <span>سابقه کار (سال)</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={1}
                    value={draft.experienceYears}
                    onChange={(event) => updateSkillDraft((previous) => ({ ...previous, experienceYears: event.target.value }))}
                    inputMode="numeric"
                    disabled={isSkillSaving}
                  />
                </label>
              </div>
              <div className={styles.modalActions}>
                <span className={styles.helperText}>
                  {isSkillSaving
                    ? "در حال ذخیره خودکار..."
                    : isSkillDraftTouched
                      ? "تغییرات پس از توقف ویرایش خودکار ذخیره می‌شوند."
                      : "ذخیره‌سازی خودکار فعال است."}
                </span>
                <button type="button" className={styles.secondaryButton} onClick={closeSkillModal} disabled={isSkillSaving}>بستن</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
