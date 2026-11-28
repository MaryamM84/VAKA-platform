import { apiBlob, apiRequest } from "@/lib/task-api";
export interface ExpenseClaim {
  claim_id: string; task_id: string; executor_profile_id: string;
  amount_irr: number; currency_code: string; description: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string; reviewed_at: string | null; rejection_reason: string;
  receipts: { receipt_id: string; mime_type: string; size_bytes: number; url: string }[];
}
const base = (taskId: string) => `/api/tasks/${encodeURIComponent(taskId)}/expense-claims/`;
export async function getExpenseClaims(
  taskId: string
): Promise<ExpenseClaim[]> {
  const response = await apiRequest<
    ExpenseClaim[] | {
      count: number;
      next: string | null;
      previous: string | null;
      results: ExpenseClaim[];
    }
  >(`/api/tasks/${taskId}/expense-claims/`);

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  throw new Error("ساختار پاسخ درخواست‌های هزینه معتبر نیست.");
}
export function createExpenseClaim(taskId: string, amountIrr: number, description: string, files: File[]) {
  const body = new FormData();
  body.append("amount_irr", String(amountIrr)); body.append("description", description);
  files.forEach(file => body.append("receipts", file));
  return apiRequest<ExpenseClaim>(base(taskId), { method: "POST", body });
}
export function decideExpenseClaim(taskId: string, claimId: string, decision: "approve" | "reject", reason?: string) {
  return apiRequest<ExpenseClaim>(`${base(taskId)}${encodeURIComponent(claimId)}/${decision}/`, { method: "POST", ...(decision === "reject" ? { body: JSON.stringify({ reason }) } : {}) });
}
export const getExpenseReceipt = (taskId: string, claimId: string, receiptId: string, signal?: AbortSignal) => apiBlob(`${base(taskId)}${encodeURIComponent(claimId)}/receipts/${encodeURIComponent(receiptId)}/`, signal);
