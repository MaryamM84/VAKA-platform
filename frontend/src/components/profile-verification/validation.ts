import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import { toEnglishDigits } from "./utils/number-utils";

export function normalizeDigits(value: string) {
  return toEnglishDigits(value).replace(/[\u200c\s-]/g, "");
}

export function onlyDigits(value: string, maxLength: number) {
  return toEnglishDigits(value).replace(/\D/g, "").slice(0, maxLength);
}

export function normalizeIban(value: string) {
  const compact = toEnglishDigits(value).replace(/[\s-]/g, "").toUpperCase();
  if (!compact) return "";
  const digits = compact.replace(/^IR/, "").replace(/\D/g, "").slice(0, 24);
  return `IR${digits}`;
}

export function validateNationalCode(value: string) {
  const code = onlyDigits(value, 10);
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;

  const check = Number(code[9]);
  const sum = code
    .slice(0, 9)
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
}

export function validateIranianIban(value: string) {
  const iban = normalizeIban(value);
  if (!/^IR\d{24}$/.test(iban)) return false;
  const rearranged = `${iban.slice(4)}1827${iban.slice(2, 4)}`;
  let remainder = 0;
  for (const digit of rearranged) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function validateMobile(value: string) {
  return /^09\d{9}$/.test(onlyDigits(value, 11));
}

export function validatePersianBirthDate(value: string, today?: Date) {
  if (!value) return false;
  try {
    const normalized = toEnglishDigits(value);
    const date = new DateObject({
      date: normalized,
      format: "YYYY/MM/DD",
      calendar: persian,
    });
    const parsed = date.toDate();
    return !Number.isNaN(parsed.getTime()) && (!today || parsed <= today);
  } catch {
    return false;
  }
}

export function getIdentityErrors(data: {
  firstName: string;
  lastName: string;
  nationalCode: string;
  birthDate: string;
  iban: string;
  mobile: string;
}, today?: Date) {
  const errors: Record<string, string> = {};
  const namePattern = /^[\p{L}]+(?:[\s‌-][\p{L}]+)*$/u;

  if (!namePattern.test(data.firstName.trim())) {
    errors.firstName = "نام را با حروف معتبر وارد کنید.";
  }
  if (!namePattern.test(data.lastName.trim())) {
    errors.lastName = "نام خانوادگی را با حروف معتبر وارد کنید.";
  }
  if (!validateNationalCode(data.nationalCode)) {
    errors.nationalCode = "کد ملی واردشده معتبر نیست.";
  }
  if (!validatePersianBirthDate(data.birthDate, today)) {
    errors.birthDate = "تاریخ تولد معتبر و غیرآینده انتخاب کنید.";
  }
  if (!validateIranianIban(data.iban)) {
    errors.iban = "شماره شبای معتبر ۲۶ کاراکتری وارد کنید.";
  }
  if (!validateMobile(data.mobile)) {
    errors.mobile = "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.";
  }

  return errors;
}
