
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

  // مرحله چهارم: بودجه و هزینه‌ها
  wageBudgetAmount: string;
  currencyCode: string;
  itemCostCapAmount: string;
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
  title: "",
  categoryName: "",
  description: "",
  deliveryCriteria: "",

  estimatedDurationMinutes: "",
  proposalDeadlineAt: getLocalDateTime(),
  executionWindowEndAt: getLocalDateTime(),
  executionStartTime: getLocalDateTime(),
  deadlineAt: getLocalDateTime(),
  urgency: "normal",

  wageBudgetAmount: "",
  currencyCode: "IRR",
  itemCostCapAmount: "",
};
