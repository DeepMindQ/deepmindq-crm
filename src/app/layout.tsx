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
  title: 'DeepMindQ — Enterprise Intelligence OS',
  description: 'AI-powered enterprise intelligence platform that transforms customer data into actionable revenue intelligence. Dedicated deployment. Customer-owned infrastructure.',
  keywords: ["enterprise intelligence platform", "customer intelligence", "AI reasoning", "dedicated deployment", "revenue intelligence", "account intelligence"],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: 'DeepMindQ — Enterprise Intelligence OS',
    description: 'AI-powered enterprise intelligence platform for revenue teams.',
    type: 'website',
    siteName: 'DeepMindQ',
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: 'DeepMindQ — Enterprise Intelligence OS' }],
  },
  twitter: {
    card: "summary_large_image",
    title: 'DeepMindQ — Enterprise Intelligence OS',
    description: 'AI-powered enterprise intelligence platform for revenue teams.',
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`antialiased ${inter.variable}`}>
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        <Providers>
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}