import { useEffect, useRef, type ReactNode } from 'react';
import './ConfirmDangerModal.css';

export type ConfirmDangerModalProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDangerModal({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDangerModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-modal-backdrop"
      data-testid="confirm-modal-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-body"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="confirm-modal-title">{title}</h2>
        <div id="confirm-modal-body" className="confirm-modal-body">{body}</div>
        <div className="confirm-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-modal-btn confirm-modal-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-modal-btn confirm-modal-confirm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
