"use client";

import { useState, type ReactNode } from "react";
import styles from "./BidSubmissionFlow.module.css";
import BidSubmissionFlow, {
  type BidSubmissionHandler,
  type BidTaskSummary,
} from "./BidSubmissionFlow";

export type { BidSubmissionHandler, BidTaskSummary } from "./BidSubmissionFlow";

export type BidSubmissionButtonProps = {
  task: BidTaskSummary;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onSubmit?: BidSubmissionHandler;
  onTrackMyTasks?: () => void;
  onBrowseTasks?: () => void;
  /** Supply the future task-card button here to preserve its existing design. */
  renderTrigger?: (open: () => void) => ReactNode;
};

/**
 * Drop-in trigger for a task card. It owns the modal state, so the task card
 * does not need to manage the two-step modal flow itself.
 */
export default function BidSubmissionButton({
  task,
  children = "ثبت پیشنهاد",
  className,
  disabled = false,
  onSubmit,
  onTrackMyTasks,
  onBrowseTasks,
  renderTrigger,
}: BidSubmissionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => {
    if (!disabled) setIsOpen(true);
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(open)
      ) : (
        <button
          type="button"
          className={className || styles.triggerButton}
          disabled={disabled}
          onClick={open}
        >
          {children}
        </button>
      )}

      <BidSubmissionFlow
        task={isOpen ? task : null}
        onClose={() => setIsOpen(false)}
        onSubmit={onSubmit}
        onTrackMyTasks={onTrackMyTasks}
        onBrowseTasks={onBrowseTasks}
      />
    </>
  );
}
