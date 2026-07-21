import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://deepmindq.com"),
  title: "DeepMindQ — Understand Before You Sell",
  description: "A personal intelligence workspace for enterprise growth. Understand companies, detect signals, map stakeholders, and create meaningful executive conversations.",
  keywords: ["enterprise growth", "account intelligence", "stakeholder mapping", "sales intelligence", "AI workspace"],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "DeepMindQ — Understand Before You Sell",
    description: "A personal intelligence workspace for enterprise growth. From data to understanding. From understanding to growth.",
    type: "website",
    siteName: "DeepMindQ",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "DeepMindQ — Understand Before You Sell" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DeepMindQ — Understand Before You Sell",
    description: "A personal intelligence workspace for enterprise growth.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`antialiased ${inter.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}