
export interface TaskFormData {
  // اطلاعات اصلی Task
  title: string;
  categoryId: string;
  categoryName: string;
  description: string;
  deliveryCriteria: string;

  // زمان‌بندی
  estimatedDurationMinutes: string;
  proposalDeadlineAt: string;
  executionStartTime: string;
  executionWindowEndAt: string;
  deadlineAt: string;
  urgency: string;

  // نوع موقعیت؛ فقط برای مدیریت فرم
  locationMode: "fixed" | "route";

  // موقعیت ثابت
  locationLatitude: string;
  locationLongitude: string;
  locationCity: string;
  locationRegion: string;
  locationAddress: string;
  locationRadiusMeters: string;
  locationBuilding: string;
  locationUnit: string;
  locationDeliveryNotes: string;

  // مبدأ مسیر
  originLatitude: string;
  originLongitude: string;
  originCity: string;
  originRegion: string;
  originAddress: string;

  // مقصد مسیر
  destinationLatitude: string;
  destinationLongitude: string;
  destinationCity: string;
  destinationRegion: string;
  destinationAddress: string;

  // بودجه
  wageBudgetAmount: string;
  itemCostCapAmount: string;
  invoiceRequired: string;
  goodsPurchaseRequired: string;
}

function getLocalDateTime(offsetMinutes = 0): string {
  const date = new Date(Date.now() + offsetMinutes * 60_000);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export const initialTaskFormData: TaskFormData = {
  // اطلاعات اصلی
  title: "",
  categoryId: "",
  categoryName: "",
  description: "",
  deliveryCriteria: "",

  // زمان‌بندی
  estimatedDurationMinutes: "",
  proposalDeadlineAt: getLocalDateTime(),
  executionStartTime: getLocalDateTime(),
  executionWindowEndAt: getLocalDateTime(),
  deadlineAt: "",
  urgency: "normal",

  // موقعیت ثابت
  locationMode: "fixed",
  locationLatitude: "",
  locationLongitude: "",
  locationCity: "",
  locationRegion: "",
  locationAddress: "",
  locationRadiusMeters: "2000",
  locationBuilding: "",
  locationUnit: "",
  locationDeliveryNotes: "",

  // مبدأ
  originLatitude: "",
  originLongitude: "",
  originCity: "",
  originRegion: "",
  originAddress: "",

  // مقصد
  destinationLatitude: "",
  destinationLongitude: "",
  destinationCity: "",
  destinationRegion: "",
  destinationAddress: "",

  // بودجه
  wageBudgetAmount: "250000",
  itemCostCapAmount: "",
  invoiceRequired: "true",
  goodsPurchaseRequired: "true",
};
