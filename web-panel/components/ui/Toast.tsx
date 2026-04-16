'use client';

import { useTheme } from 'next-themes';
import { ToastContainer, toast as toastify, ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    toastify.success(message, {
      ...options,
      className: 'bg-action text-action-foreground',
    });
  },
  error: (message: string, options?: ToastOptions) => {
    toastify.error(message, {
      ...options,
      className: 'bg-destructive text-destructive-foreground',
    });
  },
  info: (message: string, options?: ToastOptions) => {
    toastify.info(message, {
      ...options,
      className: 'bg-primary text-primary-foreground',
    });
  },
  warning: (message: string, options?: ToastOptions) => {
    toastify.warning(message, {
      ...options,
      className: 'bg-accent text-accent-foreground',
    });
  },
};

export function ToastProvider() {
  const { resolvedTheme } = useTheme();

  return (
    <ToastContainer
      position="top-right"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastClassName={() =>
        'rounded-2xl border border-border bg-[var(--surface-overlay)] text-foreground shadow-lg shadow-black/10 dark:shadow-black/40'
      }
      bodyClassName={() => 'text-sm font-medium text-foreground'}
      progressClassName="bg-primary/20"
    />
  );
}
