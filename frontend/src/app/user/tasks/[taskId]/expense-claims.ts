import { apiRequest } from "@/lib/task-api";

export interface ExpenseClaim {
  claim_id: string;
  amount_irr: number;
  description: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
  rejection_reason: string;
  receipts: { receipt_id: string }[];
}

interface ExpenseClaimPage {
  results: ExpenseClaim[];
  next?: string | null;
}

const claimPath = (taskId: string) => `/api/tasks/${encodeURIComponent(taskId)}/expense-claims/`;

export async function getExpenseClaims(taskId: string, signal: AbortSignal): Promise<ExpenseClaim[]> {
  const base = claimPath(taskId);
  const claims: ExpenseClaim[] = [];
  const visited = new Set<string>();
  let path = base;

  while (!visited.has(path)) {
    visited.add(path);
    const page = await apiRequest<ExpenseClaim[] | ExpenseClaimPage>(path, { signal });
    if (Array.isArray(page)) return [...claims, ...page];
    if (!Array.isArray(page?.results)) break;
    claims.push(...page.results);
    if (!page.next) return claims;

    const next = new URL(page.next, `http://localhost${path}`);
    if (next.pathname !== base) break;
    path = `${base}${next.search}`;
  }
  throw new Error("ساختار فهرست درخواست‌های هزینه معتبر نیست.");
}

export function createExpenseClaim(taskId: string, amountIrr: string, description: string, receipts: File[]) {
  const body = new FormData();
  body.set("amount_irr", amountIrr);
  body.set("description", description);
  for (const receipt of receipts) body.append("receipts", receipt);
  return apiRequest<ExpenseClaim>(claimPath(taskId), { method: "POST", body });
}
