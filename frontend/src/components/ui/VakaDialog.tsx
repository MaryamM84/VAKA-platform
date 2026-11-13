"use client";

import styles from "./VakaDialog.module.css";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  inputValue?: string;
  inputPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onInputChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function VakaDialog({
  open, title, description, inputValue, inputPlaceholder,
  confirmLabel = "تأیید", cancelLabel = "انصراف", busy = false,
  onInputChange, onConfirm, onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className={styles.overlay} onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel();
    }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="vaka-dialog-title" dir="rtl">
        <h2 id="vaka-dialog-title">{title}</h2>
        {description && <p>{description}</p>}
        {onInputChange && (
          <input autoFocus value={inputValue ?? ""} onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !busy) onConfirm(); }}
            placeholder={inputPlaceholder} maxLength={120} />
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={styles.confirm} onClick={onConfirm} disabled={busy}>{busy ? "در حال انجام..." : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
