"use client";

import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";

const queryClient = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        {children}
        <ToastProvider />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
