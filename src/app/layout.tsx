import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DeepMindQ — Intelligence. Insight. Impact.",
  description: "AI-powered sales intelligence platform by DeepMindQ. Discover companies, enrich contacts, and close deals faster.",
  authors: [{ name: "DeepMindQ", url: "https://www.deepmindq.com" }],
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "DeepMindQ — Intelligence. Insight. Impact.",
    description: "AI-powered sales intelligence platform. Discover companies, enrich contacts, and close deals faster.",
    type: "website",
    siteName: "DeepMindQ",
  },
  twitter: {
    card: "summary_large_image",
    title: "DeepMindQ — Intelligence. Insight. Impact.",
    description: "AI-powered sales intelligence platform by DeepMindQ.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
