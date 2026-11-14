import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";

import { appLinks } from "@atlas/ui/app-urls";
import { viewerFrom } from "@atlas/ui/auth";
import { Toaster } from "@atlas/ui/components/toast";
import { fontVariables } from "@atlas/ui/fonts";
import { COLOR_SCHEME_COOKIE, parseColorScheme, parseSidebarCollapsed, SIDEBAR_COOKIE } from "@atlas/ui/preferences";

import { Shell } from "./shell";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Clio", template: "%s · Clio" },
  description: "Chinese at your level: graded texts to read and hear, words to look up and review.",
  appleWebApp: { title: "Clio", statusBarStyle: "default", capable: true },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eeebe4" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1917" },
  ],
};

// Every screen draws its data on the device, from the device's own copy:
// these pages carry no data, so the offline copy can keep them as they are.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const viewer = viewerFrom(requestHeaders) ?? { login: "", name: "You" };
  const scheme = parseColorScheme(jar.get(COLOR_SCHEME_COOKIE)?.value);

  return (
    <html lang="en" data-theme={scheme} className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <Shell
          locale={process.env.ATLAS_LOCALE || "en-US"}
          links={appLinks()}
          viewer={viewer}
          collapsed={parseSidebarCollapsed(jar.get(SIDEBAR_COOKIE)?.value)}
          colorScheme={scheme}
        >
          {children}
        </Shell>
        <Toaster />
      </body>
    </html>
  );
}
