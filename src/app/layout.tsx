import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SentryInit } from "@/components/SentryInit";
import { localeBootScript } from "@/lib/i18n/locale";
import { readRequestLocale } from "@/lib/i18n/requestLocale";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE } from "@/lib/siteMeta";
import { metadataBaseUrl } from "@/lib/siteUrl";

const display = localFont({
  src: [
    { path: "./fonts/bricolage-grotesque-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/bricolage-grotesque-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-display",
});

const sans = localFont({
  src: [
    { path: "./fonts/figtree-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/figtree-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/figtree-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
});

const arabic = localFont({
  src: [
    { path: "./fonts/cairo-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cairo-arabic-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cairo-arabic-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/cairo-arabic-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-arabic",
  preload: false,
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#e11d2e",
};

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  openGraph: {
    type: "website",
    locale: "ar_EG",
    alternateLocale: ["en_US"],
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await readRequestLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${arabic.variable} ${geistMono.variable}`}
    >
      <body className="min-h-dvh max-w-[100vw] overflow-x-clip font-sans text-arena-ink antialiased">
        <Script
          id="qlash-locale-boot"
          nonce={nonce}
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: localeBootScript() }}
        />
        <SentryInit />
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
