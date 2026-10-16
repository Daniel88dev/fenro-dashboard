import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import {
  parseTheme,
  THEME_COOKIE,
  themeAttribute,
} from "@/modules/github-insights/ui/theme";
import { getEnv } from "@/shared/config/env";
import {
  BROWSER_SENTRY_META,
  browserSentryConfig,
} from "@/shared/infrastructure/observability/sentry-options";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Link previews need an absolute URL for the Open Graph picture.
  metadataBase: new URL(getEnv().APP_URL),
  title: "Fenro Dashboard",
  description:
    "GitHub insights and an agentic task list for the repositories you care about.",
};

// The saved colour scheme is set on the server so the first paint is already
// in the scheme the reader picked.
export default async function RootLayout({
  children,
  modal,
}: LayoutProps<"/">) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const sentry = browserSentryConfig(getEnv());

  return (
    <html
      lang="en"
      data-theme={themeAttribute(theme)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {sentry && (
          <meta name={BROWSER_SENTRY_META} content={JSON.stringify(sentry)} />
        )}
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        {modal}
      </body>
    </html>
  );
}
