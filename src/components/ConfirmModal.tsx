import { useEffect } from 'react';

export function ConfirmModal({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--bg-card)', border: '3px solid var(--gold)', borderRadius: 8,
        padding: 32, maxWidth: 480, color: 'var(--gold)',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'Bebas Neue', letterSpacing: 2, margin: 0 }}>{title}</h2>
        <p style={{ color: 'white', margin: '16px 0' }}>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}>{cancelLabel}</button>
          <button style={{ background: 'var(--green)', color: 'white', padding: '8px 16px', border: 'none', borderRadius: 4 }} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
