import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

// Monotonic counter: `Date.now()` collided when two toasts fired in the same
// millisecond, which dropped one of them early.
let nextId = 0;

const ICONS = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' };

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = (nextId += 1);
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    timers.current.set(id, setTimeout(() => dismiss(id), 3500));
  }, [dismiss]);

  const clearToasts = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, dismiss, clearToasts }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span aria-hidden="true">{ICONS[t.type] || ICONS.info}</span>
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);