import { useEffect, useRef } from 'react';

/**
 * Modal shell: closes on Escape and on overlay click, moves focus inside on
 * open, and restores it on close. Replaces the copy-pasted overlay markup that
 * was repeated across four components.
 */
export default function Modal({ title, onClose, children, maxWidth }) {
  const cardRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Callers pass inline arrows, so `onClose` gets a new identity on every
  // parent render. Holding it in a ref keeps the focus effect mount-only —
  // otherwise it re-runs on each keystroke and yanks focus out of the field
  // being typed into, silently dropping all characters after the first.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    previouslyFocused.current = document.activeElement;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);

    // Move focus to the dialog so keyboard and screen-reader users land inside.
    cardRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, []);

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={cardRef}
        style={maxWidth ? { maxWidth } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}