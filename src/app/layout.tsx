import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Cairo } from "next/font/google";
import { PWARegister } from "@/components/pwa-register";
import { LanguageProvider } from "@/lib/i18n/useI18n";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "سكرتير الموقع",
  description: "نظام متابعة المستندات والمراجعات - Sabah Al Salem South Health Center",
  applicationName: "سكرتير الموقع",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: ["/icons/icon-192.png"],
  },
  appleWebApp: {
    capable: true,
    title: "سكرتير الموقع",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="سكرتير الموقع" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${cairo.variable} font-sans antialiased bg-slate-50 text-slate-900 min-h-screen`}
        style={{ fontFamily: 'var(--font-cairo), system-ui, sans-serif' }}
      >
        <LanguageProvider>
          {children}
          <Toaster />
          <PWARegister />
        </LanguageProvider>
      </body>
    </html>
  );
}
