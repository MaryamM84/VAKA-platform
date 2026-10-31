import type { TaskFormData } from "../components/task-creation/types";
import type { TaskCreatePayload } from "./task-api";

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function parseNumber(value: string, fieldName: string): number {
  const normalized = normalizeDigits(value)
    .replace(/[,،٬\s]/g, "")
    .trim();

  const result = Number(normalized);

  if (!Number.isFinite(result)) {
    throw new Error(`مقدار فیلد ${fieldName} معتبر نیست.`);
  }

  return result;
}

function toISOString(value: string, fieldName: string): string {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    throw new Error(`تاریخ فیلد ${fieldName} معتبر نیست.`);
  }

  return date.toISOString();
}

export function buildTaskCreatePayload(
  data: TaskFormData,
): TaskCreatePayload {
  if (!data.categoryId.trim()) {
    throw new Error("شناسه دسته‌بندی انتخاب نشده است.");
  }

  const payload: TaskCreatePayload = {
    category_id: data.categoryId,
    title: data.title.trim(),
    description: data.description.trim(),
    delivery_criteria: data.deliveryCriteria.trim(),

    estimated_duration_minutes: parseNumber(
      data.estimatedDurationMinutes,
      "مدت انجام کار",
    ),

    wage_budget_amount: parseNumber(
      data.wageBudgetAmount,
      "دستمزد",
    ),

    item_cost_cap_amount:
      data.goodsPurchaseRequired === "true"
        ? parseNumber(data.itemCostCapAmount, "سقف هزینه خرید")
        : null,

    receipt_required: data.invoiceRequired === "true",

    execution_window_start_at: toISOString(
      data.executionStartTime,
      "زمان شروع اجرای کار",
    ),

    execution_window_end_at: toISOString(
      data.executionWindowEndAt,
      "زمان پایان اجرای کار",
    ),

    proposal_deadline_at: toISOString(
      data.proposalDeadlineAt,
      "مهلت دریافت پیشنهادها",
    ),

    deadline_at: data.deadlineAt
      ? toISOString(data.deadlineAt, "مهلت نهایی انجام کار")
      : null,
  };

  return payload;
}