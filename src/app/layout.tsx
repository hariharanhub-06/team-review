import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegistrar } from "@/components/pwa";

export const metadata: Metadata = {
  title: "HH Team — Engineering Work Tracker",
  description:
    "HH Team work tracking and productivity management for engineering projects",
  applicationName: "HH Team",
  manifest: "/manifest.webmanifest",
  // iOS ignores the manifest, so the standalone launch settings live here.
  appleWebApp: {
    capable: true,
    title: "HH Team",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/icon-180.png",
  },
  other: {
    // Next emits the standardised `mobile-web-app-capable`, which iOS only
    // honours from 16.4. Older iPhones still need Apple's original spelling.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e3a8a" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
  // Keeps the installed app from bouncing around like a zoomable web page.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
