"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./WalletPage.module.css";
import {
  createWalletDeposit,
  getWalletSummary,
  getWalletTransactions,
  type WalletSummary,
  type WalletTransaction,
} from "@/lib/wallet-api";

const SUGGESTED_AMOUNTS = [50000, 100000, 200000, 500000];
const PAGE_SIZE = 5;

function formatPrice(amount: number): string {
  return Math.abs(amount).toLocaleString("fa-IR");
}

// عنوان‌هایی که ممکن است از API به انگلیسی برگردند، در رابط کاربری فارسی نمایش داده می‌شوند.
function translateTransactionTitle(title: string): string {
  const normalized = title.trim().toLowerCase();

  const translations: Record<string, string> = {
    deposit: "افزایش موجودی",
    "wallet deposit": "افزایش موجودی کیف پول",
    withdrawal: "برداشت از کیف پول",
    withdraw: "برداشت از کیف پول",
    "wallet withdrawal": "برداشت از کیف پول",
    credit: "واریز",
    debit: "برداشت",
    refund: "بازگشت وجه",
    "task payment": "پرداخت بابت انجام کار",
    "payment for task": "پرداخت بابت انجام کار",
    "escrow deposit": "واریز به امانت",
    "escrow release": "آزادسازی وجه امانی",
    commission: "کارمزد",
    "service fee": "کارمزد خدمات",
    reservation: "رزرو کردن",
    reserve: "رزرو کردن",
    "wallet reservation": "رزرو کردن",
    "task reservation": "رزرو کردن",
    "reserved amount": "مبلغ رزروشده",
  };

  if (translations[normalized]) return translations[normalized];

  // پشتیبانی از عنوان‌هایی که نام عملیات را همراه با توضیح بیشتری برمی‌گردانند.
  if (normalized.includes("deposit")) return "افزایش موجودی کیف پول";
  if (normalized.includes("withdraw")) return "برداشت از کیف پول";
  if (normalized.includes("refund")) return "بازگشت وجه";
  if (
    normalized.includes("reservation") ||
    normalized.includes("reserved") ||
    normalized.includes("reserve")
  ) {
    return "رزرو کردن";
  }
  if (normalized.includes("commission") || normalized.includes("fee")) {
    return "کارمزد";
  }
  if (normalized.includes("payment")) return "پرداخت بابت انجام کار";

  return title;
}

function normalizeNumber(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬,،\s]/g, "")
    .replace(/[^\d]/g, "");
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "تاریخ نامشخص";

  return date.toLocaleString("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "خطایی رخ داد. لطفاً دوباره تلاش کنید.";
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isSafePaymentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);

  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [depositError, setDepositError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const inputAmount = Number(normalizeNumber(customAmount));
  const finalAmount = selectedAmount ?? inputAmount;

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const [summary, transactionResponse] = await Promise.all([
        getWalletSummary(),
        getWalletTransactions(1, PAGE_SIZE),
      ]);

      setWallet(summary);
      setTransactions(transactionResponse.results);
      setTotalTransactions(transactionResponse.count);
      setCurrentPage(1);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  function openDepositModal() {
    setSelectedAmount(null);
    setCustomAmount("");
    setDepositError("");
    setSuccessMessage("");
    idempotencyKeyRef.current = null;
    setIsDepositOpen(true);
  }

  function closeDepositModal() {
    if (isSubmitting) return;
    setIsDepositOpen(false);
    setDepositError("");
  }

  function handleSelectAmount(amount: number) {
    setSelectedAmount(amount);
    setCustomAmount("");
    setDepositError("");
    idempotencyKeyRef.current = null;
  }

  function handleCustomAmountChange(value: string) {
    setCustomAmount(value);
    setSelectedAmount(null);
    setDepositError("");
    idempotencyKeyRef.current = null;
  }

  async function handleDeposit() {
    if (!finalAmount || finalAmount <= 0) {
      setDepositError("لطفاً مبلغ موردنظر خود را وارد یا انتخاب کنید.");
      return;
    }

    if (!Number.isSafeInteger(finalAmount)) {
      setDepositError("مبلغ واردشده معتبر نیست.");
      return;
    }

    if (finalAmount < 10000) {
      setDepositError("حداقل مبلغ افزایش موجودی ۱۰,۰۰۰ تومان است.");
      return;
    }

    // مبلغ در رابط کاربری تومان است؛ API مبلغ را به ریال دریافت می‌کند.
    const amountInRial = finalAmount * 10;
    if (!Number.isSafeInteger(amountInRial)) {
      setDepositError("مبلغ واردشده بیش از حد مجاز است.");
      return;
    }

    setIsSubmitting(true);
    setDepositError("");

    // در صورت خطای شبکه، تلاش مجدد با همان کلید انجام می‌شود تا
    // یک درخواست تکراری در سمت سرور ثبت نشود.
    const idempotencyKey =
      idempotencyKeyRef.current ?? createIdempotencyKey();
    idempotencyKeyRef.current = idempotencyKey;

    try {
      const response = await createWalletDeposit(
        amountInRial,
        idempotencyKey
      );

      if (response.status === "SUCCEEDED") {
        idempotencyKeyRef.current = null;
        setIsDepositOpen(false);
        setSelectedAmount(null);
        setCustomAmount("");
        setSuccessMessage(
          `درخواست افزایش موجودی به مبلغ ${formatPrice(finalAmount)} تومان با موفقیت انجام شد.`
        );
        await loadWallet();
        return;
      }

      if (response.status === "PENDING" && response.payment_url) {
        if (!isSafePaymentUrl(response.payment_url)) {
          setDepositError("آدرس درگاه پرداخت معتبر نیست.");
          return;
        }
        window.location.assign(response.payment_url);
        return;
      }

      if (response.status === "PROCESSING" || response.status === "PENDING") {
        idempotencyKeyRef.current = null;
        setIsDepositOpen(false);
        setSuccessMessage("درخواست افزایش موجودی ثبت شد و در انتظار تأیید است.");
        await loadWallet();
        return;
      }

      idempotencyKeyRef.current = null;
      if (response.status === "FAILED") {
        setDepositError("درخواست پرداخت ناموفق بود. لطفاً دوباره تلاش کنید.");
      } else if (response.status === "CANCELLED") {
        setDepositError("درخواست پرداخت لغو شده است.");
      } else {
        setDepositError("وضعیت درخواست پرداخت مشخص نیست.");
      }
    } catch (error) {
      setDepositError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLoadMore() {
    if (loadingMore || transactions.length >= totalTransactions) return;

    const nextPage = currentPage + 1;
    setLoadingMore(true);
    setPageError("");

    try {
      const response = await getWalletTransactions(nextPage, PAGE_SIZE);
      setTransactions((previous) => [...previous, ...response.results]);
      setCurrentPage(nextPage);
      setTotalTransactions(response.count);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMoreTransactions = transactions.length < totalTransactions;

  return (
    <div className={styles.walletPage}>
      {pageError && (
        <div className={styles.pageError} role="alert">
          <p>{pageError}</p>
          <button type="button" onClick={loadWallet} disabled={loading}>
            تلاش دوباره
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingMessage}>
          در حال دریافت اطلاعات کیف پول...
        </div>
      ) : (
        <>
          <div className={styles.balanceGrid}>
            <div className={styles.balanceCard}>
              <div className={styles.balanceIcon}>▤</div>
              <div>
                <span>موجودی کل</span>
                <strong>{formatPrice((wallet?.total_balance ?? 0) / 10)}</strong>
                <small>تومان</small>
              </div>
            </div>

            <div className={styles.balanceCard}>
              <div className={styles.balanceIcon}>▣</div>
              <div>
                <span>موجودی قابل استفاده</span>
                <strong>{formatPrice((wallet?.available_balance ?? 0) / 10)}</strong>
                <small>تومان</small>
              </div>
            </div>

            <div className={`${styles.balanceCard} ${styles.pendingCard}`}>
              <div className={styles.balanceIcon}>♙</div>
              <div>
                <span>موجودی رزروشده در امانت</span>
                <strong>{formatPrice((wallet?.reserved_balance ?? 0) / 10)}</strong>
                <small>تومان</small>
              </div>
            </div>
          </div>

          <div className={styles.walletActions}>
            <button
              type="button"
              className={styles.depositButton}
              onClick={openDepositModal}
            >
              <span>＋</span>
              افزایش موجودی
            </button>
          </div>

          {successMessage && (
            <div className={styles.successMessage} role="status">
              <span>✓</span>
              <p>{successMessage}</p>
              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                aria-label="بستن پیام"
              >
                ×
              </button>
            </div>
          )}

          <section
            id="wallet-transactions"
            className={styles.transactionsCard}
          >
            <h3>
              <span className={styles.transactionsIcon}>▤</span>
              آخرین تراکنش‌ها
            </h3>

            <div className={styles.transactionList}>
              {transactions.length === 0 ? (
                <div className={styles.emptyTransactions}>
                  هنوز تراکنشی برای کیف پول شما ثبت نشده است.
                </div>
              ) : (
                transactions.map((transaction) => {
                  const isIncome = transaction.direction === "CREDIT";
                  const amountInToman = transaction.amount / 10;

                  return (
                    <div
                      key={transaction.transaction_id}
                      className={styles.transactionRow}
                    >
                      <div className={styles.transactionInfo}>
                        <div
                          className={`${styles.transactionIcon} ${
                            isIncome ? styles.incomeIcon : styles.expenseIcon
                          }`}
                        >
                          {isIncome ? "◇" : "⊖"}
                        </div>
                        <div>
                          <strong>{translateTransactionTitle(transaction.title)}</strong>
                          <span>{formatDate(transaction.created_at)}</span>
                          {transaction.description && (
                            <span>{transaction.description}</span>
                          )}
                        </div>
                      </div>

                      <strong
                        className={
                          isIncome
                            ? styles.incomeAmount
                            : styles.expenseAmount
                        }
                      >
                        {isIncome ? "+" : "−"}
                        {formatPrice(amountInToman)} تومان
                      </strong>
                    </div>
                  );
                })
              )}
            </div>

            {hasMoreTransactions && (
              <button
                type="button"
                className={styles.allTransactionsButton}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "در حال دریافت..." : "مشاهده بیشتر"}
              </button>
            )}
          </section>
        </>
      )}

      {isDepositOpen && (
        <div className={styles.modalOverlay} onClick={closeDepositModal}>
          <section
            className={styles.depositModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeDepositModal}
              aria-label="بستن پنجره"
              disabled={isSubmitting}
            >
              ×
            </button>

            <h2 id="deposit-title">افزایش موجودی کیف پول</h2>
            <p className={styles.modalDescription}>
              مبلغ موردنظر خود را انتخاب کنید یا به‌صورت دلخواه وارد کنید.
            </p>

            <div className={styles.amountSection}>
              <span className={styles.amountLabel}>انتخاب مبلغ پیشنهادی</span>
              <div className={styles.amountOptions}>
                {SUGGESTED_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    disabled={isSubmitting}
                    className={
                      selectedAmount === amount
                        ? styles.amountOptionActive
                        : styles.amountOption
                    }
                    onClick={() => handleSelectAmount(amount)}
                  >
                    {formatPrice(amount)}
                    <small>تومان</small>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.customAmountSection}>
              <label htmlFor="custom-amount">
                یا مبلغ دلخواه خود را وارد کنید
              </label>
              <div className={styles.amountInputWrapper}>
                <input
                  id="custom-amount"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="مثلاً ۱۵۰۰۰۰"
                  value={customAmount}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    handleCustomAmountChange(event.target.value)
                  }
                />
                <span>تومان</span>
              </div>
              <small>حداقل مبلغ قابل انتخاب: ۱۰,۰۰۰ تومان</small>
            </div>

            {depositError && (
              <p className={styles.errorMessage} role="alert">
                {depositError}
              </p>
            )}

            <div className={styles.depositSummary}>
              <span>مبلغ انتخاب‌شده</span>
              <strong>{formatPrice(finalAmount || 0)} تومان</strong>
            </div>

            <button
              type="button"
              className={styles.confirmDepositButton}
              onClick={handleDeposit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "در حال ثبت درخواست..." : "تأیید و افزایش موجودی"}
            </button>

            <button
              type="button"
              className={styles.cancelDepositButton}
              onClick={closeDepositModal}
              disabled={isSubmitting}
            >
              انصراف
            </button>

            <p className={styles.demoNotice}>
              در حالت آزمایشی، افزایش موجودی واقعی نیست و فقط برای تست عملکرد
              کیف پول استفاده می‌شود.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
