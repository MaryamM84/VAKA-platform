
"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import Link from "next/link";
import styles from "./EditProfile.module.css";

const provinces = [
  { value: "tehran", label: "تهران" },
  { value: "alborz", label: "البرز" },
  { value: "ardabil", label: "اردبیل" },
  { value: "azarbaijan-east", label: "آذربایجان شرقی" },
  { value: "azarbaijan-west", label: "آذربایجان غربی" },
  { value: "bushehr", label: "بوشهر" },
  { value: "chaharmahal", label: "چهارمحال و بختیاری" },
  { value: "south-khorasan", label: "خراسان جنوبی" },
  { value: "razavi-khorasan", label: "خراسان رضوی" },
  { value: "north-khorasan", label: "خراسان شمالی" },
  { value: "khuzestan", label: "خوزستان" },
  { value: "zanjan", label: "زنجان" },
  { value: "semnan", label: "سمنان" },
  { value: "sistan", label: "سیستان و بلوچستان" },
  { value: "fars", label: "فارس" },
  { value: "qazvin", label: "قزوین" },
  { value: "qom", label: "قم" },
  { value: "kurdistan", label: "کردستان" },
  { value: "kerman", label: "کرمان" },
  { value: "kermanshah", label: "کرمانشاه" },
  { value: "kohgiluyeh", label: "کهگیلویه و بویراحمد" },
  { value: "golestan", label: "گلستان" },
  { value: "gilan", label: "گیلان" },
  { value: "lorestan", label: "لرستان" },
  { value: "mazandaran", label: "مازندران" },
  { value: "markazi", label: "مرکزی" },
  { value: "hormozgan", label: "هرمزگان" },
  { value: "hamadan", label: "همدان" },
  { value: "yazd", label: "یزد" },
  { value: "isfahan", label: "اصفهان" },
  { value: "ilam", label: "ایلام" },
];

const tehranCities = [
  { value: "tehran", label: "تهران" },
  { value: "rey", label: "ری" },
  { value: "shemiranat", label: "شمیرانات" },
];

const initialFormValues = {
  firstName: "مریم",
  lastName: "احمدی",
  phone: "09123456789",
  birthDate: "۱۳۸۳/۰۱/۰۱",
  province: "tehran",
  city: "tehran",
  about: "",
};

type FormValues = typeof initialFormValues;
type FormErrors = Partial<Record<keyof FormValues, string>>;

function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = "لطفاً نام خود را وارد کنید.";
  }

  if (!values.lastName.trim()) {
    errors.lastName = "لطفاً نام خانوادگی خود را وارد کنید.";
  }

  if (!values.birthDate.trim()) {
    errors.birthDate = "لطفاً تاریخ تولد خود را انتخاب کنید.";
  }

  if (!values.province) {
    errors.province = "لطفاً استان خود را انتخاب کنید.";
  }

  if (!values.city) {
    errors.city = "لطفاً شهر خود را انتخاب کنید.";
  }

  if (!values.about.trim()) {
    errors.about = "لطفاً بخش درباره من را تکمیل کنید.";
  } else if (values.about.trim().length < 10) {
    errors.about = "توضیحات باید حداقل ۱۰ کاراکتر داشته باشد.";
  }

  return errors;
}

export default function EditProfilePage() {
  const [formValues, setFormValues] =
    useState<FormValues>(initialFormValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState("");

  const isDirty =
    JSON.stringify(formValues) !== JSON.stringify(initialFormValues);

  const cities = formValues.province === "tehran" ? tehranCities : [];

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  function handleChange(field: keyof FormValues, value: string) {
    setFormValues((previous) => ({
      ...previous,
      [field]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
    }));

    setSuccessMessage("");
  }

  function handleProvinceChange(value: string) {
    setFormValues((previous) => ({
      ...previous,
      province: value,
      city: "",
    }));

    setErrors((previous) => ({
      ...previous,
      province: undefined,
      city: undefined,
    }));

    setSuccessMessage("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(formValues);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setSuccessMessage("");
      return;
    }

    setSuccessMessage(
      "اطلاعات در پیش‌نمایش ثبت شد. برای ذخیره دائمی، اتصال به سرور لازم است."
    );
  }

  function handleCancel(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      isDirty &&
      !window.confirm(
        "تغییراتی دارید که هنوز ذخیره نشده‌اند. آیا مطمئن هستید که می‌خواهید خارج شوید؟"
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <div className={styles.editProfile}>
      <div className={styles.intro}>
        <h2>ویرایش اطلاعات شخصی</h2>
        <p>
          اطلاعات پروفایل خود را تکمیل کنید تا دیگران بهتر با شما آشنا شوند.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <section className={styles.card}>
          <div className={styles.sectionHeading}>
            <div>
              <h3>اطلاعات شخصی</h3>
              <p>اطلاعات اصلی حساب کاربری خود را وارد کنید.</p>
            </div>
          </div>

          <div className={styles.fieldsGrid}>
            <div className={styles.field}>
              <label htmlFor="firstName">
                نام <span className={styles.required}>*</span>
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                value={formValues.firstName}
                onChange={(event) =>
                  handleChange("firstName", event.target.value)
                }
                placeholder="نام خود را وارد کنید"
                maxLength={50}
                required
                aria-invalid={!!errors.firstName}
                aria-describedby={errors.firstName ? "firstName-error" : undefined}
                className={errors.firstName ? styles.inputError : ""}
              />
              {errors.firstName && (
                <span id="firstName-error" className={styles.fieldError}>
                  {errors.firstName}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="lastName">
                نام خانوادگی <span className={styles.required}>*</span>
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                value={formValues.lastName}
                onChange={(event) =>
                  handleChange("lastName", event.target.value)
                }
                placeholder="نام خانوادگی خود را وارد کنید"
                maxLength={50}
                required
                aria-invalid={!!errors.lastName}
                aria-describedby={errors.lastName ? "lastName-error" : undefined}
                className={errors.lastName ? styles.inputError : ""}
              />
              {errors.lastName && (
                <span id="lastName-error" className={styles.fieldError}>
                  {errors.lastName}
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="phone">شماره تلفن همراه</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                dir="ltr"
                value={formValues.phone}
                readOnly
                aria-describedby="phone-hint"
                className={styles.readOnlyInput}
              />
              <span id="phone-hint" className={styles.fieldHint}>
                این شماره تأیید شده است و از این قسمت قابل تغییر نیست.
              </span>
            </div>

            <div className={styles.field}>
              <label htmlFor="birthDate">
                تاریخ تولد <span className={styles.required}>*</span>
              </label>
              <DatePicker
                id="birthDate"
                calendar={persian}
                locale={persian_fa}
                calendarPosition="bottom-right"
                value={formValues.birthDate}
                onChange={(date) => {
                  if (date) {
                    handleChange("birthDate", date.format("YYYY/MM/DD"));
                  }
                }}
                format="YYYY/MM/DD"
                inputClass={`${styles.datePickerInput} ${
                  errors.birthDate ? styles.inputError : ""
                }`}
                containerClassName={styles.datePickerContainer}
                placeholder="انتخاب تاریخ تولد"
                required
                aria-describedby={errors.birthDate ? "birthDate-error" : undefined}
              />
              {errors.birthDate ? (
                <span id="birthDate-error" className={styles.fieldError}>
                  {errors.birthDate}
                </span>
              ) : (
                <span className={styles.fieldHint}>
                  تاریخ تولد را از تقویم انتخاب کنید.
                </span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="province">
                استان <span className={styles.required}>*</span>
              </label>
              <select
                id="province"
                name="province"
                value={formValues.province}
                onChange={(event) =>
                  handleProvinceChange(event.target.value)
                }
                required
                aria-invalid={!!errors.province}
                className={errors.province ? styles.inputError : ""}
              >
                <option value="">استان خود را انتخاب کنید</option>
                {provinces.map((province) => (
                  <option key={province.value} value={province.value}>
                    {province.label}
                  </option>
                ))}
              </select>
              {errors.province && (
                <span className={styles.fieldError}>{errors.province}</span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="city">
                شهر <span className={styles.required}>*</span>
              </label>
              <select
                id="city"
                name="city"
                value={formValues.city}
                onChange={(event) => handleChange("city", event.target.value)}
                disabled={!formValues.province || cities.length === 0}
                required
                aria-invalid={!!errors.city}
                className={errors.city ? styles.inputError : ""}
              >
                <option value="">
                  {formValues.province
                    ? "شهر خود را انتخاب کنید"
                    : "ابتدا استان را انتخاب کنید"}
                </option>
                {cities.map((city) => (
                  <option key={city.value} value={city.value}>
                    {city.label}
                  </option>
                ))}
              </select>
              {errors.city ? (
                <span className={styles.fieldError}>{errors.city}</span>
              ) : (
                <span className={styles.fieldHint}>
                  {cities.length === 0
                    ? "فهرست شهرهای این استان پس از اتصال به بک‌اند فعال می‌شود."
                    : "شهر محل سکونت خود را انتخاب کنید."}
                </span>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="about">
              درباره من <span className={styles.required}>*</span>
            </label>
            <textarea
              id="about"
              name="about"
              rows={5}
              maxLength={500}
              value={formValues.about}
              onChange={(event) => handleChange("about", event.target.value)}
              placeholder="کمی درباره خودتان، مهارت‌ها و تجربه‌هایتان بنویسید..."
              required
              aria-invalid={!!errors.about}
              aria-describedby={errors.about ? "about-error" : "about-hint"}
              className={errors.about ? styles.inputError : ""}
            />
            {errors.about ? (
              <span id="about-error" className={styles.fieldError}>
                {errors.about}
              </span>
            ) : (
              <span id="about-hint" className={styles.fieldHint}>
                توضیح کوتاهی درباره خودتان بنویسید تا کارفرمایان بیشتر با شما
                آشنا شوند.
              </span>
            )}
          </div>
        </section>

        {successMessage && (
          <div className={styles.successMessage} role="status">
            {successMessage}
          </div>
        )}

        <div className={styles.actions}>
          <Link
            href="/profile"
            className={styles.cancelButton}
            onClick={handleCancel}
          >
            انصراف
          </Link>

          <button type="submit" className={styles.saveButton}>
            ذخیره تغییرات
          </button>
        </div>
      </form>
    </div>
  );
}
