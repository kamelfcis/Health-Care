import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { LoadingOverlayProvider } from "@/components/providers/loading-overlay-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

export const metadata: Metadata = {
  title: "Opero Manage",
  description: "Hospital management system for multi-clinic operations, scheduling, and billing",
  icons: {
    icon: "/opero-manage-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">
        <QueryProvider>
          <ThemeProvider>
            <I18nProvider>
              <LoadingOverlayProvider>
                {children}
                <Toaster richColors position="top-right" />
              </LoadingOverlayProvider>
            </I18nProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
