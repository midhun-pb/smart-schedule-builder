import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
            ? AlertCircle
            : Info;

        const iconColor =
          toast.type === 'success'
            ? 'text-emerald-500'
            : toast.type === 'error'
            ? 'text-red-500'
            : 'text-blue-500';

        return (
          <div
            key={toast.id}
            className="pointer-events-auto p-4 rounded-2xl glass-panel border border-white/40 dark:border-white/10 shadow-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {toast.title}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                {toast.message}
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
