export interface TaskFormData {
  // مرحله اول: عنوان و مشخصات
  title: string;
  categoryName: string;
  description: string;
  deliveryCriteria: string;

  // مرحله دوم: زمان‌بندی
  estimatedDurationMinutes: string;
  proposalDeadlineAt: string;
  executionWindowEndAt: string;
  executionStartTime: string;
  deadlineAt: string;
  urgency: string;

  // مکان ثابت
  locationMode: string;
  locationLatitude: string;
  locationLongitude: string;
  locationAddress: string;

  // مبدأ و مقصد
  originLatitude: string;
  originLongitude: string;
  originAddress: string;
  destinationLatitude: string;
  destinationLongitude: string;
  destinationAddress: string;

  // اطلاعات خصوصی
  locationBuilding: string;
  locationUnit: string;
  locationDeliveryNotes: string;
  locationRadiusMeters: string;

  // بودجه
  wageBudgetAmount: string;
  currencyCode: string;
  itemCostCapAmount: string;
  goodsPurchaseRequired: string;
  invoiceRequired: string;
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
  // مرحله اول
  title: "",
  categoryName: "",
  description: "",
  deliveryCriteria: "",

  // مرحله دوم
  estimatedDurationMinutes: "",
  proposalDeadlineAt: getLocalDateTime(),
  executionWindowEndAt: getLocalDateTime(),
  executionStartTime: getLocalDateTime(),
  deadlineAt: getLocalDateTime(),
  urgency: "normal",

  // مرحله سوم
  locationMode: "fixed",

  locationLatitude: "",
  locationLongitude: "",
  locationRadiusMeters: "2000",
  locationAddress: "",

  originLatitude: "",
  originLongitude: "",
  originAddress: "",

  destinationLatitude: "",
  destinationLongitude: "",
  destinationAddress: "",

  locationBuilding: "",
  locationUnit: "",
  locationDeliveryNotes: "",

  // مرحله چهارم
  wageBudgetAmount: "250000",
  currencyCode: "IRR",
  itemCostCapAmount: "180000",
  goodsPurchaseRequired: "true",
  invoiceRequired: "true",
};
