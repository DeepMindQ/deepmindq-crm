import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeepMindQ — Lead Intelligence & AI-Powered Outreach",
  description: "AI-powered lead intelligence and controlled outbound outreach platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}