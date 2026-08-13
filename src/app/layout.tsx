import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["700", "800"],
});

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "600", "700"],
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  preload: false,
});

export const metadata: Metadata = {
  title: "QuizArena — Live classroom quiz, built for the rush",
  description:
    "Host up to 80 players in a real-time quiz arena. Instant join, sharp scoring, projector-ready control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen font-sans text-arena-ink antialiased">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
