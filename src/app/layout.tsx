import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DeepMindQ — Understand Before You Sell",
  description: "AI-powered enterprise growth intelligence platform. Understand companies, detect signals, map stakeholders, and create meaningful executive conversations.",
  keywords: ["sales intelligence", "AI outreach", "account research", "stakeholder mapping", "enterprise sales", "lead intelligence"],
  openGraph: {
    title: "DeepMindQ — Understand Before You Sell",
    description: "AI-powered enterprise growth intelligence platform. From data to understanding. From understanding to growth.",
    type: "website",
    siteName: "DeepMindQ",
  },
  twitter: {
    card: "summary_large_image",
    title: "DeepMindQ — Understand Before You Sell",
    description: "AI-powered enterprise growth intelligence platform.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`antialiased ${inter.variable} ${playfair.variable}`}>
        {children}
      </body>
    </html>
  );
}