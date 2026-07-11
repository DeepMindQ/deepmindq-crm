import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DeepMindQ — Intelligence. Insight. Impact.",
  description: "AI-powered enterprise sales intelligence CRM.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          html{-webkit-text-size-adjust:100%}
          body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f0;color:#1a1a1a;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;line-height:1.5}
          button{cursor:pointer;border:none;background:none;font-family:inherit;font-size:inherit}
          input,select,textarea{font-family:inherit;font-size:inherit}
          a{text-decoration:none;color:inherit}
          table{border-collapse:collapse;width:100%}
          ::-webkit-scrollbar{width:5px;height:5px}
          ::-webkit-scrollbar-track{background:transparent}
          ::-webkit-scrollbar-thumb{background:#d1d1c7;border-radius:9px}
          ::-webkit-scrollbar-thumb:hover{background:#b0b0a5}
          @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
          @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
          .fade-in{animation:fadeIn .3s ease both}
          .fade-in-1{animation:fadeIn .3s ease .05s both}
          .fade-in-2{animation:fadeIn .3s ease .1s both}
          .fade-in-3{animation:fadeIn .3s ease .15s both}
          .fade-in-4{animation:fadeIn .3s ease .2s both}
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}