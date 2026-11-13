
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import Link from "next/link";
import styles from "./EditProfile.module.css";

import {
  getMyProfile,
  updateMyProfile,
  type MyProfile,
} from "@/lib/profile-api";

import {
  getProvinces,
  getCitiesByProvince,
} from "@/lib/locations-api";

type FormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  province: string;
  city: string;
  about: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const emptyFormValues: FormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  birthDate: "",
  province: "",
  city: "",
  about: "",
};

function getFullNameParts(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = "لطفاً نام خود را وارد کنید.";
  }

  if (!values.lastName.trim()) {
    errors.lastName = "لطفاً نام خانوادگی خود را وارد کنید.";
  }

  if (
    values.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  ) {
    errors.email = "لطفاً یک نشانی ایمیل معتبر وارد کنید.";
  }

  if (values.about.trim().length > 500) {
    errors.about = "توضیحات نباید بیشتر از ۵۰۰ کاراکتر باشد.";
  }

  return errors;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "عملیات ناموفق بود. لطفاً دوباره تلاش کنید.";
}

export default function EditProfilePage() {
  const [formValues, setFormValues] =
    useState<FormValues>(emptyFormValues);

  const [initialValues, setInitialValues] =
    useState<FormValues>(emptyFormValues);

  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState("");
  const [pageError, setPageError] = useState("");
  const [saveError, setSaveError] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // دریافت اطلاعات استان‌ها از فایل JSON محلی
  const provinces = useMemo(() => getProvinces(), []);

  // دریافت شهرهای استان انتخاب‌شده از فایل JSON محلی
  const cities = useMemo(
    () => getCitiesByProvince(formValues.province),
    [formValues.province]
  );

  const isDirty = useMemo(
    () => JSON.stringify(formValues) !== JSON.stringify(initialValues),
    [formValues, initialValues]
  );

  // دریافت اطلاعات پروفایل کاربر
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setPageError("");

        const profile: MyProfile = await getMyProfile();

        if (!isMounted) return;

        const nameParts = getFullNameParts(profile.full_name);

        const loadedValues: FormValues = {
          ...emptyFormValues,
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
          phone: profile.phone ?? "",
          email: profile.email ?? "",
          about: profile.bio ?? "",
        };

        setFormValues(loadedValues);
        setInitialValues(loadedValues);
      } catch (error) {
        if (isMounted) {
          setPageError(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  // هشدار هنگام خروج با تغییرات ذخیره‌نشده
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

  const handleChange = useCallback(
    (field: keyof FormValues, value: string) => {
      setFormValues((previous) => ({
        ...previous,
        [field]: value,
      }));

      setErrors((previous) => ({
        ...previous,
        [field]: undefined,
      }));

      setSuccessMessage("");
      setSaveError("");
    },
    []
  );

  // با تغییر استان، شهر قبلی پاک می‌شود
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
    setSaveError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm(formValues);

    setErrors(validationErrors);
    setSuccessMessage("");
    setSaveError("");

    if (Object.keys(validationErrors).length > 0) return;

    const fullName =
      `${formValues.firstName.trim()} ${formValues.lastName.trim()}`.trim();

    try {
      setSaving(true);

      const updatedProfile = await updateMyProfile({
        full_name: fullName,
        email: formValues.email.trim() || null,
        bio: formValues.about.trim() || null,
      });

      const savedName = getFullNameParts(
        updatedProfile.full_name || fullName
      );

      const savedValues: FormValues = {
        ...formValues,
        firstName: savedName.firstName,
        lastName: savedName.lastName,
        phone: updatedProfile.phone ?? formValues.phone,
        email: updatedProfile.email ?? "",
        about: updatedProfile.bio ?? "",
      };

      setFormValues(savedValues);

      // فقط فیلدهایی که API پشتیبانی می‌کند به‌عنوان ذخیره‌شده ثبت می‌شوند.
      // تاریخ تولد، استان و شهر در API فعلی ذخیره دائمی نمی‌شوند.
      setInitialValues((previous) => ({
        ...previous,
        firstName: savedValues.firstName,
        lastName: savedValues.lastName,
        phone: savedValues.phone,
        email: savedValues.email,
        about: savedValues.about,
      }));

      setSuccessMessage(
        "نام، ایمیل و درباره من با موفقیت ذخیره شدند. تاریخ تولد، استان و شهر فعلاً در API اصلی پشتیبانی نمی‌شوند و فقط در همین فرم باقی می‌مانند."
      );
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel(event: MouseEvent<HTMLAnchorElement>) {
    if (
      isDirty &&
      !window.confirm(
        "تغییراتی دارید که هنوز ذخیره نشده‌اند. آیا مطمئن هستید که می‌خواهید خارج شوید؟"
      )
    ) {
      event.preventDefault();
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState} role="status">
        در حال دریافت اطلاعات پروفایل...
      </div>
    );
  }

  if (pageError) {
    return (
      <div className={styles.errorState} role="alert">
        <p>{pageError}</p>

        <button
          type="button"
          onClick={() => window.location.reload()}
        >
          تلاش مجدد
        </button>
      </div>
    );
  }

  return (
    <div className={styles.editProfile}>
      <form
        className={styles.form}
        onSubmit={handleSubmit}
        noValidate
      >
        <section className={styles.card}>
          <div className={styles.sectionHeading}>
            <div>
              <h3>اطلاعات شخصی</h3>
              <p>اطلاعات اصلی حساب کاربری خود را وارد کنید.</p>
            </div>
          </div>

          <div className={styles.fieldsGrid}>
            {/* نام */}
            <div className={styles.field}>
              <label htmlFor="firstName">
                نام <span className={styles.required}>*</span>
              </label>

              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                value={formValues.firstName}
                onChange={(event) =>
                  handleChange("firstName", event.target.value)
                }
                placeholder="نام خود را وارد کنید"
                maxLength={80}
                required
                aria-invalid={!!errors.firstName}
                className={errors.firstName ? styles.inputError : ""}
              />

              {errors.firstName && (
                <span className={styles.fieldError}>
                  {errors.firstName}
                </span>
              )}
            </div>

            {/* نام خانوادگی */}
            <div className={styles.field}>
              <label htmlFor="lastName">
                نام خانوادگی <span className={styles.required}>*</span>
              </label>

              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                value={formValues.lastName}
                onChange={(event) =>
                  handleChange("lastName", event.target.value)
                }
                placeholder="نام خانوادگی خود را وارد کنید"
                maxLength={80}
                required
                aria-invalid={!!errors.lastName}
                className={errors.lastName ? styles.inputError : ""}
              />

              {errors.lastName && (
                <span className={styles.fieldError}>
                  {errors.lastName}
                </span>
              )}
            </div>

            {/* شماره تلفن */}
            <div className={styles.field}>
              <label htmlFor="phone">شماره تلفن همراه</label>

              <input
                id="phone"
                type="tel"
                dir="ltr"
                value={formValues.phone}
                readOnly
                className={styles.readOnlyInput}
              />

              <span className={styles.fieldHint}>
                این شماره از حساب شما دریافت شده و قابل تغییر نیست.
              </span>
            </div>

            {/* ایمیل */}
            <div className={styles.field}>
              <label htmlFor="email">ایمیل</label>

              <input
                id="email"
                type="email"
                dir="ltr"
                autoComplete="email"
                value={formValues.email}
                onChange={(event) =>
                  handleChange("email", event.target.value)
                }
                placeholder="name@example.com"
                maxLength={254}
                aria-invalid={!!errors.email}
                className={errors.email ? styles.inputError : ""}
              />

              {errors.email ? (
                <span className={styles.fieldError}>
                  {errors.email}
                </span>
              ) : (
                <span className={styles.fieldHint}>
                  ایمیل از طریق API پروفایل ذخیره می‌شود.
                </span>
              )}
            </div>

            {/* تاریخ تولد */}
            <div className={styles.field}>
              <label htmlFor="birthDate">تاریخ تولد</label>

              <DatePicker
                id="birthDate"
                calendar={persian}
                locale={persian_fa}
                calendarPosition="bottom-right"
                value={formValues.birthDate}
                onChange={(date) =>
                  handleChange(
                    "birthDate",
                    date ? date.format("YYYY/MM/DD") : ""
                  )
                }
                format="YYYY/MM/DD"
                inputClass={styles.datePickerInput}
                containerClassName={styles.datePickerContainer}
                placeholder="انتخاب تاریخ تولد"
              />

              <span className={styles.fieldHint}>
                این فیلد در API فعلی وجود ندارد و فعلاً ذخیره دائمی نمی‌شود.
              </span>
            </div>

            {/* استان */}
            <div className={styles.field}>
              <label htmlFor="province">استان</label>

              <select
                id="province"
                value={formValues.province}
                onChange={(event) =>
                  handleProvinceChange(event.target.value)
                }
                disabled={provinces.length === 0}
              >
                <option value="">
                  استان خود را انتخاب کنید
                </option>

                {provinces.map((province) => (
                  <option
                    key={province.id}
                    value={String(province.id)}
                  >
                    {province.name}
                  </option>
                ))}
              </select>

              <span className={styles.fieldHint}>
                {provinces.length
                  ? `${provinces.length} استان در دسترس است.`
                  : "فهرست استان‌ها خالی است."}
              </span>
            </div>

            {/* شهر */}
            <div className={styles.field}>
              <label htmlFor="city">شهر</label>

              <select
                id="city"
                value={formValues.city}
                onChange={(event) =>
                  handleChange("city", event.target.value)
                }
                disabled={!formValues.province || cities.length === 0}
              >
                <option value="">
                  {!formValues.province
                    ? "ابتدا استان را انتخاب کنید"
                    : cities.length
                      ? "شهر خود را انتخاب کنید"
                      : "شهری برای نمایش وجود ندارد"}
                </option>

                {cities.map((city) => (
                  <option
                    key={city.id}
                    value={String(city.id)}
                  >
                    {city.name}
                  </option>
                ))}
              </select>

              <span className={styles.fieldHint}>
                {cities.length
                  ? `${cities.length} شهر در این استان وجود دارد.`
                  : "انتخاب شهر فعلاً ذخیره دائمی نمی‌شود."}
              </span>
            </div>
          </div>

          {/* درباره من */}
          <div className={styles.field}>
            <label htmlFor="about">درباره من</label>

            <textarea
              id="about"
              rows={5}
              maxLength={500}
              value={formValues.about}
              onChange={(event) =>
                handleChange("about", event.target.value)
              }
              placeholder="کمی درباره خودتان، مهارت‌ها و تجربه‌هایتان بنویسید..."
              aria-invalid={!!errors.about}
              className={errors.about ? styles.inputError : ""}
              style={{ resize: "none" }}
            />

            {errors.about ? (
              <span className={styles.fieldError}>
                {errors.about}
              </span>
            ) : (
              <span className={styles.fieldHint}>
                این توضیحات در پروفایل شما ذخیره می‌شود.
              </span>
            )}
          </div>
        </section>

        {/* پیام موفقیت */}
        {successMessage && (
          <div className={styles.successMessage} role="status">
            {successMessage}
          </div>
        )}

        {/* پیام خطا */}
        {saveError && (
          <div className={styles.errorMessage} role="alert">
            {saveError}
          </div>
        )}

        {/* دکمه‌ها */}
        <div className={styles.actions}>
          <Link
            href="/profile"
            className={styles.cancelButton}
            onClick={handleCancel}
          >
            انصراف
          </Link>

          <button
            type="submit"
            className={styles.saveButton}
            disabled={saving}
          >
            {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
          </button>
        </div>
      </form>
    </div>
  );
}
