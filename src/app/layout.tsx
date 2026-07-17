import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Ravi Shanker",
    url: "https://deepmindq.com",
    jobTitle: "Enterprise Growth Leader & Technology Strategist",
    description: "Builder of DeepMindQ — a personal AI-powered intelligence workspace for enterprise growth.",
    sameAs: ["https://www.linkedin.com/in/shankerpisupati/"],
    email: "shanker001@gmail.com",
    knowsAbout: ["Enterprise Sales", "Sales Intelligence", "AI", "Stakeholder Mapping", "Account Research", "Growth Strategy"],
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`antialiased ${inter.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}