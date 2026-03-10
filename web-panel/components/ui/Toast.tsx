'use client';

import { ToastContainer, toast as toastify, ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Custom toast wrapper with design system styling
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
      theme="light"
      toastClassName="rounded-lg shadow-lg border border-border"
      bodyClassName="text-sm font-medium"
      progressClassName="bg-primary/20"
    />
  );
}
