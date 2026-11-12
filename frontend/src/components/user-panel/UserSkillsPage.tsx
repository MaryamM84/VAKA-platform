"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import UserPanelLayout from "./UserPanelLayout";
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

type ScheduleDay = {
  id: string;
  label: string;
  enabled: boolean;
  from: string;
  to: string;
};

type ScheduleGroup = {
  id: "weekdays" | "thursday" | "friday";
  label: string;
  dayIds: string[];
};

type ProfileSettings = {
  skills: Skill[];
  categories: WorkCategory[];
  areas: string[];
  radiusKm: number;
  latitude: number;
  longitude: number;
  address: string;
  cityWide: boolean;
  schedule: ScheduleDay[];
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

const STORAGE_KEY = "vaka.executor-settings.v1";
const emptyDraft: SkillDraft = {
  skillId: "",
  level: "beginner",
  experienceYears: "0",
};

const initialProfile: ProfileSettings = {
  skills: [],
  categories: [
    { id: "shopping", label: "خریدهای فوری و تحویل کالا", icon: "bag", active: true },
    { id: "admin", label: "امور اداری و نوبت‌گیری", icon: "building", active: true },
    { id: "cleaning", label: "نظافت و خانه‌داری", icon: "cleaning", active: true },
    { id: "delivery", label: "جابه‌جایی بسته‌های سبک", icon: "package", active: true },
    { id: "pets", label: "نگهداری حیوانات (پیتاری)", icon: "paw", active: false },
    { id: "repairs", label: "تعمیرات و خدمات فنی ساده", icon: "tools", active: false },
  ],
  areas: ["سعادت‌آباد", "شهرک غرب", "صادقیه", "ونک"],
  radiusKm: 10,
  latitude: 35.8045,
  longitude: 51.4324,
  address: "تهران، تجریش",
  cityWide: true,
  schedule: [
    { id: "sat", label: "شنبه", enabled: true, from: "09:00", to: "18:00" },
    { id: "sun", label: "یکشنبه", enabled: true, from: "09:00", to: "18:00" },
    { id: "mon", label: "دوشنبه", enabled: true, from: "09:00", to: "18:00" },
    { id: "tue", label: "سه‌شنبه", enabled: true, from: "09:00", to: "18:00" },
    { id: "wed", label: "چهارشنبه", enabled: true, from: "09:00", to: "18:00" },
    { id: "thu", label: "پنجشنبه", enabled: true, from: "09:00", to: "14:00" },
    { id: "fri", label: "جمعه", enabled: false, from: "09:00", to: "14:00" },
  ],
};

const scheduleGroups: ScheduleGroup[] = [
  { id: "weekdays", label: "شنبه تا چهارشنبه", dayIds: ["sat", "sun", "mon", "tue", "wed"] },
  { id: "thursday", label: "پنجشنبه", dayIds: ["thu"] },
  { id: "friday", label: "جمعه", dayIds: ["fri"] },
];

const areaSuggestions = [
  "تجریش",
  "قیطریه",
  "نیاوران",
  "پونک",
  "جنت‌آباد",
  "مرزداران",
  "یوسف‌آباد",
  "جردن",
  "اکباتان",
  "تهران‌پارس",
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
  return {
    ...profile,
    skills: profile.skills.map((skill) => ({ ...skill })),
    categories: profile.categories.map((category) => ({ ...category })),
    areas: [...profile.areas],
    schedule: profile.schedule.map((day) => ({ ...day })),
  };
}

function restoreProfile(value: unknown): ProfileSettings {
  if (!value || typeof value !== "object") return cloneProfile(initialProfile);

  const candidate = value as Partial<ProfileSettings>;
  const base = cloneProfile(initialProfile);

  const skills: Skill[] = [];

  const categories = base.categories.map((seed) => {
    const stored = Array.isArray(candidate.categories)
      ? (candidate.categories as WorkCategory[]).find((item) => item?.id === seed.id)
      : undefined;
    return stored && typeof stored.active === "boolean"
      ? { ...seed, active: stored.active }
      : seed;
  });

  const areas = Array.isArray(candidate.areas)
    ? Array.from(
        new Map(
          candidate.areas
            .filter((area): area is string => typeof area === "string" && area.trim().length > 0)
            .map((area) => {
              const clean = toPersianDigits(area.trim().normalize("NFKC").replace(/\s+/g, " "));
              return [clean.toLocaleLowerCase("fa-IR"), clean] as const;
            }),
        ).values(),
      )
    : base.areas;

  const storedSchedule = Array.isArray(candidate.schedule)
    ? (candidate.schedule as ScheduleDay[])
    : [];
  const schedule = base.schedule.map((day) => {
    const stored = storedSchedule.find((item) => item?.id === day.id);
    if (!stored) return day;
    const storedFrom =
      typeof stored.from === "string" ? normalizeTimeInput(stored.from) : day.from;
    const storedTo =
      typeof stored.to === "string" ? normalizeTimeInput(stored.to) : day.to;
    return {
      ...day,
      enabled: typeof stored.enabled === "boolean" ? stored.enabled : day.enabled,
      from: isValidTime(storedFrom) ? storedFrom : day.from,
      to: isValidTime(storedTo) ? storedTo : day.to,
    };
  });

  return {
    skills,
    categories,
    areas,
    radiusKm:
      typeof candidate.radiusKm === "number" && Number.isFinite(candidate.radiusKm)
        ? Math.min(35, Math.max(1, candidate.radiusKm))
        : base.radiusKm,
    latitude:
      typeof candidate.latitude === "number" && Number.isFinite(candidate.latitude)
        ? candidate.latitude
        : base.latitude,
    longitude:
      typeof candidate.longitude === "number" && Number.isFinite(candidate.longitude)
        ? candidate.longitude
        : base.longitude,
    address: typeof candidate.address === "string" ? toPersianDigits(candidate.address) : base.address,
    cityWide: typeof candidate.cityWide === "boolean" ? candidate.cityWide : base.cityWide,
    schedule,
  };
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

function formatScheduleGroupTitle(group: ScheduleGroup, schedule: ScheduleDay[]) {
  const enabledDays = group.dayIds
    .map((dayId) => schedule.find((day) => day.id === dayId))
    .filter((day): day is ScheduleDay => Boolean(day?.enabled));

  if (enabledDays.length === 0) return group.label;
  if (group.id === "weekdays" && enabledDays.length === 5) return "شنبه تا چهارشنبه";
  if (enabledDays.length === 1) return enabledDays[0].label;

  const names = enabledDays.map((day) => `${day.label}‌ها`);
  return `${names.slice(0, -1).join("، ")} و ${names[names.length - 1]}`;
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

export default function UserSkillsPage() {
  const [profile, setProfile] = useState<ProfileSettings>(() => cloneProfile(initialProfile));
  const [savedProfile, setSavedProfile] = useState<ProfileSettings>(() => cloneProfile(initialProfile));
  const [skillCatalog, setSkillCatalog] = useState<SkillCatalogItem[]>([]);
  const [isSkillsLoading, setIsSkillsLoading] = useState(true);
  const [skillProfileLoadError, setSkillProfileLoadError] = useState<string | null>(null);
  const [isSkillSaving, setIsSkillSaving] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileName, setProfileName] = useState("مریم احمدی");
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SkillDraft>(emptyDraft);
  const [areaEditorOpen, setAreaEditorOpen] = useState(false);
  const [newArea, setNewArea] = useState("");
  const [scheduleEditorGroup, setScheduleEditorGroup] = useState<ScheduleGroup | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<{ enabledDays: string[]; from: string; to: string }>({
    enabledDays: [],
    from: "09:00",
    to: "18:00",
  });
  const storageKeyRef = useRef(STORAGE_KEY);

  useEffect(() => {
    let key = STORAGE_KEY;
    let name = "مریم احمدی";
    let restored = cloneProfile(initialProfile);
    let storageWarning = "";

    try {
      const rawAuth =
        window.localStorage.getItem("vaka.auth") ??
        window.sessionStorage.getItem("vaka.auth");

      if (rawAuth) {
        const auth = JSON.parse(rawAuth) as {
          user?: { user_id?: string; full_name?: string };
        };
        if (auth.user?.user_id) key = `${STORAGE_KEY}:${auth.user.user_id}`;
        if (auth.user?.full_name?.trim()) name = auth.user.full_name.trim();
      }

      const rawSettings = window.localStorage.getItem(key);
      if (rawSettings) restored = restoreProfile(JSON.parse(rawSettings) as unknown);
    } catch {
      storageWarning = "تنظیمات ذخیره‌شده قابل خواندن نبود؛ مقادیر پیش‌فرض بارگذاری شد.";
    }

    storageKeyRef.current = key;
    setProfileName(name);
    setProfile(restored);
    setSavedProfile(cloneProfile(restored));
    if (storageWarning) setToast(storageWarning);
    setIsHydrated(true);
  }, []);

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
          const skills = records.map(mapWorkerSkill);
          setProfile((previous) => ({ ...previous, skills }));
          setSavedProfile((previous) => ({ ...previous, skills }));
          setSkillProfileLoadError(null);
        }
      } catch (error) {
        const message = getErrorText(error);
        errors.push(`مهارت‌های ثبت‌شده: ${message}`);
        if (isCurrent) setSkillProfileLoadError(message);
      }

      if (isCurrent) {
        if (errors.length) setToast(errors.join(" "));
        setIsSkillsLoading(false);
      }
    }

    void loadSkillData();
    return () => { isCurrent = false; };
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(savedProfile),
    [profile, savedProfile],
  );

  const activeDays = profile.schedule.filter((day) => day.enabled).length;
  const selectedCatalogSkill = skillCatalog.find((item) => item.skill_id === draft.skillId);
  const selectedSkillCategory = selectedCatalogSkill?.category_name
    ?? profile.skills.find((skill) => skill.skillId === draft.skillId)?.category
    ?? "عمومی / بدون دسته‌بندی";
  const completion = Math.min(
    100,
    54 + Math.min(profile.skills.length, 4) * 6 + Math.min(profile.areas.length, 4) * 2 + (activeDays > 0 ? 5 : 0),
  );

  const updateLocation = useCallback((latitude: number, longitude: number, address: string) => {
    setProfile((previous) => ({ ...previous, latitude, longitude, address }));
  }, []);

  const addAreaFromMap = useCallback((area: string) => {
    const localizedArea = toPersianDigits(area.trim().normalize("NFKC").replace(/\s+/g, " "));
    const normalized = localizedArea.toLocaleLowerCase("fa-IR");
    if (!normalized) return;

    setProfile((previous) => {
      const exists = previous.areas.some(
        (item) =>
          toPersianDigits(item).normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase("fa-IR") === normalized,
      );
      return exists ? previous : { ...previous, areas: [...previous.areas, localizedArea] };
    });
  }, []);

  function showToast(message: string) {
    setToast(message);
  }

  function saveChanges() {
    const invalidDay = profile.schedule.find(
      (day) => day.enabled && (!isValidTime(day.from) || !isValidTime(day.to) || day.from >= day.to),
    );
    if (invalidDay) {
      showToast(`بازه زمانی ${invalidDay.label} معتبر نیست؛ ساعت پایان باید بعد از ساعت شروع باشد.`);
      return;
    }

    if (profile.radiusKm < 1 || profile.radiusKm > 35) {
      showToast("شعاع فعالیت باید بین ۱ تا ۳۵ کیلومتر باشد.");
      return;
    }

    if (isSaving || !isHydrated) return;
    setIsSaving(true);

    try {
      window.localStorage.setItem(storageKeyRef.current, JSON.stringify(profile));
      setSavedProfile(cloneProfile(profile));
      showToast("تغییرات با موفقیت در همین مرورگر ذخیره شد.");
    } catch {
      showToast("ذخیره‌سازی مرورگر در دسترس نیست؛ فضای ذخیره‌سازی را بررسی کنید.");
    } finally {
      setIsSaving(false);
    }
  }

  function resetChanges() {
    setProfile(cloneProfile(savedProfile));
    setModalOpen(false);
    setEditingSkillId(null);
    setDraft(emptyDraft);
    setAreaEditorOpen(false);
    setNewArea("");
    setScheduleEditorGroup(null);
    setToast("تغییرات ذخیره‌نشده لغو شد.");
  }

  function toggleCategory(categoryId: string) {
    setProfile((previous) => ({
      ...previous,
      categories: previous.categories.map((category) =>
        category.id === categoryId ? { ...category, active: !category.active } : category,
      ),
    }));
  }

  function openAddSkill() {
    if (isSkillsLoading || skillProfileLoadError || skillCatalog.length === 0) {
      showToast("ابتدا باید فهرست مهارت‌ها و اطلاعات حساب از سرور دریافت شوند.");
      return;
    }
    setEditingSkillId(null);
    setDraft({ ...emptyDraft, skillId: skillCatalog[0]?.skill_id ?? "" });
    setModalOpen(true);
  }

  function openEditSkill(skill: Skill) {
    setEditingSkillId(skill.id);
    setDraft({
      skillId: skill.skillId,
      level: skill.level,
      experienceYears: String(skill.experienceYears),
    });
    setModalOpen(true);
  }

  async function submitSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSkillSaving) return;

    const experienceYears = Number(toLatinDigits(draft.experienceYears));
    if (!draft.skillId || !Number.isInteger(experienceYears) || experienceYears < 0 || experienceYears > 60) {
      showToast("مهارت و سابقه کار معتبر (بین صفر تا ۶۰ سال) را انتخاب کنید.");
      return;
    }

    setIsSkillSaving(true);
    try {
      const payload = {
        proficiency_level: mapUiLevel(draft.level),
        experience_years: experienceYears,
      };
      const record = editingSkillId
        ? await updateMySkill(editingSkillId, payload)
        : await addMySkill({ skill_id: draft.skillId, ...payload });
      const savedSkill = mapWorkerSkill(record);

      setProfile((previous) => ({
        ...previous,
        skills: editingSkillId
          ? previous.skills.map((skill) => skill.id === editingSkillId ? savedSkill : skill)
          : [...previous.skills, savedSkill],
      }));
      setSavedProfile((previous) => ({
        ...previous,
        skills: editingSkillId
          ? previous.skills.map((skill) => skill.id === editingSkillId ? savedSkill : skill)
          : [...previous.skills, savedSkill],
      }));
      showToast(editingSkillId ? "مهارت با موفقیت در سرور ویرایش شد." : "مهارت با موفقیت در سرور ثبت شد.");
      setModalOpen(false);
      setEditingSkillId(null);
      setDraft(emptyDraft);
    } catch (error) {
      showToast(getErrorText(error));
    } finally {
      setIsSkillSaving(false);
    }
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
      setSavedProfile((previous) => ({
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

  function addArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const area = toPersianDigits(newArea.trim());
    if (!area) return;
    if (profile.areas.some((item) => item.toLocaleLowerCase("fa") === area.toLocaleLowerCase("fa"))) {
      showToast("این محله از قبل در فهرست مناطق شما وجود دارد.");
      return;
    }
    setProfile((previous) => ({ ...previous, areas: [...previous.areas, area] }));
    setNewArea("");
    setAreaEditorOpen(false);
    showToast("محله به مناطق تحت پوشش اضافه شد.");
  }

  function removeArea(area: string) {
    setProfile((previous) => ({ ...previous, areas: previous.areas.filter((item) => item !== area) }));
  }

  function openScheduleEditor(group: ScheduleGroup) {
    const days = group.dayIds
      .map((dayId) => profile.schedule.find((day) => day.id === dayId))
      .filter((day): day is ScheduleDay => Boolean(day));
    const referenceDay = days.find((day) => day.enabled) ?? days[0];

    setScheduleDraft({
      enabledDays: days.filter((day) => day.enabled).map((day) => day.id),
      from: referenceDay?.from ?? "09:00",
      to: referenceDay?.to ?? "18:00",
    });
    setScheduleEditorGroup(group);
  }

  function toggleScheduleDraftDay(dayId: string) {
    setScheduleDraft((previous) => ({
      ...previous,
      enabledDays: previous.enabledDays.includes(dayId)
        ? previous.enabledDays.filter((id) => id !== dayId)
        : [...previous.enabledDays, dayId],
    }));
  }

  function saveScheduleGroup() {
    if (!scheduleEditorGroup) return;
    if (
      scheduleDraft.enabledDays.length > 0 &&
      (!isValidTime(scheduleDraft.from) || !isValidTime(scheduleDraft.to) || scheduleDraft.from >= scheduleDraft.to)
    ) {
      showToast("ساعت شروع و پایان را معتبر وارد کنید؛ ساعت پایان باید بعد از ساعت شروع باشد.");
      return;
    }

    setProfile((previous) => ({
      ...previous,
      schedule: previous.schedule.map((day) =>
        scheduleEditorGroup.dayIds.includes(day.id)
          ? {
              ...day,
              enabled: scheduleDraft.enabledDays.includes(day.id),
              from: scheduleDraft.from,
              to: scheduleDraft.to,
            }
          : day,
      ),
    }));
    setScheduleEditorGroup(null);
    showToast("برنامه زمانی ویرایش شد؛ برای ثبت نهایی، ذخیره نهایی تغییرات را بزنید.");
  }

  return (
    <UserPanelLayout
      profileName={profileName}
      completion={completion}
      rating={4.8}
      completedTaskCount={12}
      receivedOffersCount={3}
      activePage="skills"
      isVerified
    >
      <div className={styles.contentStack}>
        <section className={`${styles.card} ${styles.pageHeading}`}>
          <div className={styles.headingCopy}>
            <span className={styles.headingIcon}><Icon name="sliders" size={20} /></span>
            <h1>مدیریت مهارت‌ها و شرایط کاری مجری</h1>
          </div>
          <div className={styles.headingActions}>
            <button type="button" className={styles.secondaryButton} onClick={resetChanges} disabled={!isHydrated || !isDirty || isSaving}>
              انصراف و بازنشانی
            </button>
            <button type="button" className={styles.primaryButton} onClick={saveChanges} disabled={!isHydrated || !isDirty || isSaving} aria-busy={isSaving}>
              <Icon name="check" size={17} />
              ذخیره نهایی تغییرات
            </button>
          </div>
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
              <span className={styles.countBadge}>{toPersianDigits(profile.skills.length.toLocaleString("fa-IR"))} مهارت فعال</span>
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

        <section className={`${styles.card} ${styles.categoryCard}`} aria-labelledby="categories-title">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleWrap}>
              <span className={styles.sectionIcon}><Icon name="shapes" size={21} /></span>
              <h2 id="categories-title">دسته‌بندی‌های کاری موردعلاقه</h2>
            </div>
            <span className={styles.helperText}>دسته‌هایی که باید آگهی‌های آن در اولویت باشند</span>
          </div>

          <div className={styles.categoryGrid}>
            {profile.categories.map((category) => (
              <button
                type="button"
                key={category.id}
                className={`${styles.categoryChip} ${category.active ? styles.categoryChipActive : ""}`}
                aria-pressed={category.active}
                onClick={() => toggleCategory(category.id)}
              >
                <span className={styles.categoryIcon}><Icon name={categoryIcons[category.icon]} size={19} /></span>
                <span className={styles.categoryLabel}>{category.label}</span>
                <span className={styles.categoryCheck}>{category.active ? <Icon name="check" size={16} /> : <Icon name="plus" size={16} />}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="coverage-title">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleWrap}>
              <span className={styles.sectionIcon}><Icon name="compass" size={21} /></span>
              <h2 id="coverage-title">محدوده جغرافیایی و مناطق تحت پوشش</h2>
            </div>
            <span className={styles.cityBadge}>شهر: تهران <Icon name="pin" size={14} /></span>
          </div>

          <div className={styles.areaSection}>
            <div className={styles.areaHeading}>
              <span>محله‌ها و مناطق فعالیت برگزیده:</span>
            </div>
            <div className={styles.areaTags}>
              {profile.areas.map((area) => (
                <span className={styles.areaTag} key={area}>
                  {area}
                  <button type="button" onClick={() => removeArea(area)} aria-label={`حذف ${area}`} title={`حذف ${area}`}><Icon name="x" size={12} /></button>
                </span>
              ))}
              {!areaEditorOpen ? (
                <button type="button" className={styles.addAreaButton} onClick={() => setAreaEditorOpen(true)}>
                  <Icon name="plus" size={14} /> افزودن محله جدید
                </button>
              ) : (
                <form className={styles.addAreaForm} onSubmit={addArea}>
                  <label className={styles.srOnly} htmlFor="new-coverage-area">نام محله جدید</label>
                  <input
                    id="new-coverage-area"
                    list="coverage-area-suggestions"
                    value={newArea}
                    onChange={(event) => setNewArea(toPersianDigits(event.target.value))}
                    placeholder="نام محله..."
                    autoFocus
                  />
                  <datalist id="coverage-area-suggestions">
                    {areaSuggestions.map((area) => <option value={area} key={area} />)}
                  </datalist>
                  <button type="submit" disabled={!newArea.trim()} aria-label="افزودن محله"><Icon name="check" size={14} /></button>
                  <button type="button" onClick={() => { setAreaEditorOpen(false); setNewArea(""); }} aria-label="لغو"><Icon name="x" size={14} /></button>
                </form>
              )}
            </div>
          </div>

          <div className={styles.radiusSection}>
            <div className={styles.radiusHeading}>
              <label htmlFor="coverage-radius">شعاع جغرافیایی مجاز برای انجام کار:</label>
              <strong>تا {toPersianDigits(profile.radiusKm.toLocaleString("fa-IR"))} کیلومتر از مبدأ</strong>
            </div>
            <input
              id="coverage-radius"
              className={styles.rangeInput}
              type="range"
              min={1}
              max={35}
              step={1}
              value={profile.radiusKm}
              onChange={(event) => setProfile((previous) => ({ ...previous, radiusKm: Number(event.target.value) }))}
              aria-valuetext={`${toPersianDigits(profile.radiusKm)} کیلومتر`}
            />
            <div className={styles.rangeLabels}>
              <span>۱ کیلومتر (فقط محله من)</span>
              <span>۱۰ کیلومتر (منطقه شهری)</span>
              <span>۳۵ کیلومتر (کل استان تهران)</span>
            </div>
          </div>

          <CoverageMap
            latitude={profile.latitude}
            longitude={profile.longitude}
            radiusMeters={profile.radiusKm * 1000}
            onLocationChange={updateLocation}
            onAreaSelect={addAreaFromMap}
          />

          <div className={styles.citywideRow}>
            <span className={styles.citywideIcon}><Icon name="delivery" size={18} /></span>
            <div className={styles.citywideCopy}>
              <strong>پذیرش کارهای سراسر شهر</strong>
              <span>در صورت پوشش کامل هزینه رفت‌وآمد توسط کارفرما</span>
            </div>
            <button
              type="button"
              className={`${styles.switch} ${profile.cityWide ? styles.switchOn : ""}`}
              role="switch"
              aria-checked={profile.cityWide}
              aria-label="پذیرش کارهای سراسر شهر"
              onClick={() => setProfile((previous) => ({ ...previous, cityWide: !previous.cityWide }))}
            ><span /></button>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="availability-title">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleWrap}>
              <span className={styles.sectionIcon}><Icon name="calendar" /></span>
              <div>
                <h2 id="availability-title">زمان‌های در دسترس بودن و تقویم کاری</h2>
                <p className={styles.sectionSubtext}>مدیریت روزها و بازه‌های زمانی پذیرش سفارش‌ها</p>
              </div>
            </div>
            <span className={styles.activeHoursBadge}><span aria-hidden="true" />ساعات فعال آماده‌به‌کار</span>
          </div>

          <div className={styles.scheduleList}>
            {scheduleGroups.map((group) => {
              const groupDays = group.dayIds
                .map((dayId) => profile.schedule.find((day) => day.id === dayId))
                .filter((day): day is ScheduleDay => Boolean(day));
              const enabledDays = groupDays.filter((day) => day.enabled);
              const allEnabled = groupDays.length > 0 && enabledDays.length === groupDays.length;
              const allDisabled = enabledDays.length === 0;
              const referenceDay = enabledDays[0] ?? groupDays[0];
              const sameHours = enabledDays.every(
                (day) => day.from === referenceDay?.from && day.to === referenceDay?.to,
              );
              const dayTitle = formatScheduleGroupTitle(group, profile.schedule);
              const timeText = allDisabled
                ? "تعطیل و استراحت هفتگی"
                : sameHours && referenceDay
                  ? `از ${formatScheduleTime(referenceDay.from)} الی ${formatScheduleTime(referenceDay.to)}`
                  : "بازه‌های زمانی متفاوت";

              return (
                <button
                  type="button"
                  key={group.id}
                  className={`${styles.scheduleRow} ${allDisabled ? styles.scheduleRowDisabled : ""}`}
                  onClick={() => openScheduleEditor(group)}
                  aria-label={`ویرایش برنامه ${dayTitle}`}
                >
                  <span className={styles.scheduleIcon}><Icon name="calendar" size={19} /></span>
                  <strong className={styles.dayName}>{dayTitle}</strong>
                  <span className={`${styles.scheduleTime} ${allDisabled ? styles.offDayText : ""}`}>{timeText}</span>
                  <span className={`${styles.scheduleStatus} ${allDisabled ? styles.scheduleStatusRest : ""}`}>
                    {allDisabled ? "استراحت" : allEnabled ? "فعال" : "ترکیبی"}
                  </span>
                </button>
              );
            })}
          </div>

        </section>
      </div>

      {scheduleEditorGroup && (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="schedule-modal-title">ویرایش زمان {formatScheduleGroupTitle(scheduleEditorGroup, profile.schedule)}</h2>
                <p>روزهای فعال و ساعت پذیرش سفارش را مشخص کنید.</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setScheduleEditorGroup(null)} aria-label="بستن پنجره"><Icon name="x" /></button>
            </div>
            <div className={styles.scheduleEditorDays}>
              {scheduleEditorGroup.dayIds.map((dayId) => {
                const day = profile.schedule.find((item) => item.id === dayId);
                if (!day) return null;
                return (
                  <label className={styles.scheduleEditorDay} key={day.id}>
                    <input
                      type="checkbox"
                      checked={scheduleDraft.enabledDays.includes(day.id)}
                      onChange={() => toggleScheduleDraftDay(day.id)}
                    />
                    <span>{day.label}</span>
                  </label>
                );
              })}
            </div>
            <div className={styles.formGrid}>
              <label className={styles.scheduleTimeField}>
                <span>ساعت شروع</span>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={5}
                  placeholder="۰۹:۰۰"
                  value={toPersianDigits(scheduleDraft.from)}
                  onChange={(event) =>
                    setScheduleDraft((previous) => ({ ...previous, from: normalizeTimeInput(event.target.value) }))
                  }
                  aria-label="ساعت شروع به قالب ساعت و دقیقه"
                />
              </label>
              <label className={styles.scheduleTimeField}>
                <span>ساعت پایان</span>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={5}
                  placeholder="۱۸:۰۰"
                  value={toPersianDigits(scheduleDraft.to)}
                  onChange={(event) =>
                    setScheduleDraft((previous) => ({ ...previous, to: normalizeTimeInput(event.target.value) }))
                  }
                  aria-label="ساعت پایان به قالب ساعت و دقیقه"
                />
              </label>
            </div>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setScheduleEditorGroup(null)}>انصراف</button>
              <button type="button" className={styles.primaryButton} onClick={saveScheduleGroup}><Icon name="check" size={16} />ثبت زمان‌بندی</button>
            </div>
          </section>
        </div>
      )}

      {modalOpen && (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="skill-modal-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="skill-modal-title">{editingSkillId ? "ویرایش مهارت" : "افزودن مهارت جدید"}</h2>
                <p>مهارت را از فهرست موجود انتخاب کنید و سطح و سابقه کار را مشخص کنید.</p>
              </div>
              <button type="button" className={styles.iconButton} onClick={() => setModalOpen(false)} aria-label="بستن پنجره" disabled={isSkillSaving}><Icon name="x" /></button>
            </div>
            <form className={styles.skillForm} onSubmit={submitSkill}>
              <label>
                <span>عنوان مهارت</span>
                <select
                  value={draft.skillId}
                  onChange={(event) => setDraft((previous) => ({ ...previous, skillId: event.target.value }))}
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
                    onChange={(event) => setDraft((previous) => ({ ...previous, level: event.target.value as SkillLevel }))}
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
                    onChange={(event) => setDraft((previous) => ({ ...previous, experienceYears: event.target.value }))}
                    inputMode="numeric"
                    disabled={isSkillSaving}
                  />
                </label>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setModalOpen(false)} disabled={isSkillSaving}>انصراف</button>
                <button type="submit" className={styles.primaryButton} disabled={isSkillSaving || !draft.skillId}>
                  <Icon name="check" size={16} /> {isSkillSaving ? "در حال ذخیره..." : editingSkillId ? "ثبت ویرایش" : "افزودن مهارت"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </UserPanelLayout>
  );
}
