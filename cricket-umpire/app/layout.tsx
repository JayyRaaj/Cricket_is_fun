import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cricket Umpire — Live Match Scoring",
  description:
    "Professional cricket umpiring and scoring app. Track balls, overs, runs, wickets, and extras in real-time. Shareable match state via URL.",
  keywords: ["cricket", "umpire", "scoring", "match", "live score"],
  openGraph: {
    title: "Cricket Umpire — Live Match Scoring",
    description: "Professional cricket umpiring and scoring app",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <head>
        {/* Inline Theme Initialiser script to prevent flash of un-themed content */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('cricket-umpire-theme');
                  var html = document.documentElement;
                  html.classList.remove('dark', 'light', 'sunlight');
                  if (theme === 'light' || theme === 'sunlight') {
                    html.classList.add(theme);
                  } else if (theme === 'dark') {
                    html.classList.add('dark');
                  } else {
                    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    html.classList.add(systemDark ? 'dark' : 'light');
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
