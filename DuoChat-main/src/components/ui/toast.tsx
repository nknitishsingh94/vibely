'use client';

import * as React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

type ToastListener = (toasts: ToastItem[]) => void;

let listeners: ToastListener[] = [];
let activeToasts: ToastItem[] = [];

function notify() {
  listeners.forEach((l) => l([...activeToasts]));
}

export const toast = {
  show(message: string, type: ToastType = 'info') {
    const id = Math.random().toString(36).substring(2, 9);
    activeToasts = [...activeToasts, { id, type, message }];
    notify();
    setTimeout(() => {
      activeToasts = activeToasts.filter((t) => t.id !== id);
      notify();
    }, 3500);
  },
  success(message: string) {
    this.show(message, 'success');
  },
  error(message: string) {
    this.show(message, 'error');
  },
  info(message: string) {
    this.show(message, 'info');
  },
};

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4 sm:p-0">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-lg border backdrop-blur-md text-xs font-medium transition-all animate-in slide-in-from-bottom-2 duration-200 ${
              isSuccess
                ? 'bg-card/95 text-foreground border-emerald-500/30'
                : isError
                ? 'bg-destructive/10 text-destructive border-destructive/30'
                : 'bg-card/95 text-foreground border-border'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
              {isError && <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
              {!isSuccess && !isError && <Info className="w-4 h-4 text-primary shrink-0" />}
              <span className="truncate">{t.message}</span>
            </div>
            <button
              onClick={() => {
                activeToasts = activeToasts.filter((item) => item.id !== t.id);
                notify();
              }}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded-md cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
