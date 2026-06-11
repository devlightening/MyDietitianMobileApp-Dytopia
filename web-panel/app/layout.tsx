import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Toaster } from 'react-hot-toast';
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dytopia | Diyetisyenler için dijital klinik işletim sistemi",
  description: "Diyetisyen web paneli ve danışan mobil uygulamasını tek premium SaaS platformunda birleştirin.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get locale and messages (next-intl will use i18n/request.ts)
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className="overflow-x-hidden">
      <body className="overflow-x-hidden bg-background text-foreground">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'var(--surface-raised)',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid var(--border-default)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  boxShadow: 'var(--shadow-card)',
                  borderRadius: '18px',
                },
                success: {
                  iconTheme: { primary: 'var(--brand-primary)', secondary: 'var(--surface-raised)' },
                },
              }}
            />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
