import { apiRequest } from "./task-api";

export interface WalletSummary {
  wallet_id: string;
  currency_code: string;
  total_balance: number;
  available_balance: number;
  reserved_balance: number;
  updated_at: string;
}

export interface WalletTransaction {
  transaction_id: string;
  type: string;
  direction: "CREDIT" | "DEBIT";
  amount: number;
  currency_code: string;
  status: string;
  title: string;
  description: string;
  task_id: string | null;
  created_at: string;
}

export interface PaginatedWalletTransactions {
  count: number;
  next: string | null;
  previous: string | null;
  results: WalletTransaction[];
}

export type WalletDepositStatus =
  | "PROCESSING"
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export interface WalletDepositResponse {
  deposit_id: string;
  status: WalletDepositStatus;
  amount: number;
  currency_code: string;
  payment_url: string;
  expires_at: string | null;
}

/** دریافت خلاصه موجودی کیف پول کاربر */
export function getWalletSummary(): Promise<WalletSummary> {
  return apiRequest<WalletSummary>("/api/wallet/summary/", {
    method: "GET",
  });
}

/** دریافت تراکنش‌های کیف پول به‌صورت صفحه‌بندی‌شده */
export function getWalletTransactions(
  page = 1,
  pageSize = 10
): Promise<PaginatedWalletTransactions> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  return apiRequest<PaginatedWalletTransactions>(
    `/api/wallet/transactions/?${params.toString()}`,
    { method: "GET" }
  );
}

/** ثبت درخواست افزایش موجودی؛ amount بر حسب ریال است. */
export function createWalletDeposit(
  amountInRial: number,
  idempotencyKey: string
): Promise<WalletDepositResponse> {
  return apiRequest<WalletDepositResponse>("/api/wallet/deposit/", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ amount: amountInRial }),
  });
}
