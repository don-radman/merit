import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckIcon, InfoIcon } from '@/components/icons.tsx';

/**
 * Small, quiet confirmations — "Link copied", "Payout run complete". Bottom
 * centre, one at a time is plenty, auto-dismiss, announced to screen readers
 * through a polite live region. Errors do NOT go here: they are banners in
 * place, where the user is looking.
 */
export interface Toast {
  id: number;
  title: string;
  body?: string;
  kind?: 'ok' | 'info';
}

interface ToastApi {
  push: (t: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = nextId.current++;
    setToasts((ts) => [...ts.slice(-1), { ...t, id }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((ts) => ts.slice(1)), 3800);
    return () => clearTimeout(t);
  }, [toasts]);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" role="status" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind ?? 'ok'}`}>
            {t.kind === 'info' ? <InfoIcon size={16} /> : <CheckIcon size={16} />}
            <div>
              <div className="toast__title">{t.title}</div>
              {t.body && <div className="toast__body">{t.body}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
