import provincesData from "@/data/locations/provinces.json";
import citiesData from "@/data/locations/cities.json";

export interface LocationOption {
  id: number;
  name: string;
}

interface ProvinceRecord {
  id: number;
  name: string;
}

interface CityRecord {
  id: number;
  name: string;
  province_id: number;
}

const provinces = provincesData as ProvinceRecord[];
const cities = citiesData as CityRecord[];

/**
 * دریافت فهرست استان‌ها
 */
export function getProvinces(): LocationOption[] {
  return provinces
    .map((province) => ({
      id: province.id,
      name: province.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

/**
 * دریافت شهرهای مربوط به یک استان
 */
export function getCitiesByProvince(
  provinceId: string | number
): LocationOption[] {
  if (
    provinceId === "" ||
    provinceId === null ||
    provinceId === undefined
  ) {
    return [];
  }

  const normalizedProvinceId = Number(provinceId);

  if (!Number.isInteger(normalizedProvinceId)) {
    return [];
  }

  return cities
    .filter((city) => city.province_id === normalizedProvinceId)
    .map((city) => ({
      id: city.id,
      name: city.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

/**
 * پیدا کردن استان با شناسه
 */
export function getProvinceById(
  provinceId: string | number
): LocationOption | undefined {
  const id = Number(provinceId);
  const province = provinces.find((item) => item.id === id);

  return province
    ? {
        id: province.id,
        name: province.name,
      }
    : undefined;
}

/**
 * پیدا کردن شهر با شناسه
 */
export function getCityById(
  cityId: string | number
): LocationOption | undefined {
  const id = Number(cityId);
  const city = cities.find((item) => item.id === id);

  return city
    ? {
        id: city.id,
        name: city.name,
      }
    : undefined;
}