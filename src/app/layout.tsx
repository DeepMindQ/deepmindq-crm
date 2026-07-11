import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DeepMindQ CRM",
  description: "AI-powered sales intelligence platform.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #f9fafb; color: #111827; -webkit-font-smoothing: antialiased; }
          button { cursor: pointer; border: none; background: none; font-family: inherit; }
          input, select { font-family: inherit; }
          a { text-decoration: none; color: inherit; }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}