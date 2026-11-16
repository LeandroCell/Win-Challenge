import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Win-Challenge",
  description: "Win-Challenges anlegen, Siege zählen, Zeit stoppen.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Setzt Farbe + Hell/Dunkel vor dem ersten Rendern, damit nichts aufblitzt.
const themeScript = `try{var t=JSON.parse(localStorage.getItem("wc-theme")||"{}");var d=document.documentElement;d.dataset.accent=t.accent||"graphite";if(t.mode==="light"||t.mode==="dark")d.dataset.theme=t.mode;}catch(e){document.documentElement.dataset.accent="graphite";}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-accent="graphite" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
