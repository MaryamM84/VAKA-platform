const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const englishDigits = "0123456789";

/** Convert Persian and Arabic-Indic digits to English digits. */
export function toEnglishDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persianIndex = persianDigits.indexOf(digit);
    if (persianIndex !== -1) return englishDigits[persianIndex];

    const arabicIndex = arabicDigits.indexOf(digit);
    return arabicIndex !== -1 ? englishDigits[arabicIndex] : digit;
  });
}

/** Convert English digits to Persian digits for display. */
export function toPersianDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => persianDigits[Number(digit)]);
}
