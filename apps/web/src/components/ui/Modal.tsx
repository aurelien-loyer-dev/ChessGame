import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import './modal.css';

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 440,
  dismissable = true,
}: {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  width?: number;
  dismissable?: boolean;
}) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => dismissable && onClose?.()}
        >
          <motion.div
            className="modal panel"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, rotateX: -18, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, rotateX: 12, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || (dismissable && onClose)) && (
              <header className="modal-head">
                {title && <h2>{title}</h2>}
                {dismissable && onClose && (
                  <button className="btn ghost icon sm" onClick={onClose} aria-label="Fermer">
                    <X />
                  </button>
                )}
              </header>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
