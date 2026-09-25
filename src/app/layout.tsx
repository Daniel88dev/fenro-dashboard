import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";

import {
  parseTheme,
  THEME_COOKIE,
  themeAttribute,
} from "@/modules/github-insights/ui/theme";

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
  title: "Fenro Dashboard",
  description:
    "GitHub insights and an agentic task list for the repositories you care about.",
};

/**
 * `modal` is the slot the task dialogs render into: a task or New task
 * opened from inside the app shows over the page it was opened from.
 *
 * The saved colour scheme is set on the html element here, on the server, so
 * the first paint is already in the scheme the reader picked.
 */
export default async function RootLayout({
  children,
  modal,
}: LayoutProps<"/">) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={themeAttribute(theme)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        {modal}
      </body>
    </html>
  );
}
