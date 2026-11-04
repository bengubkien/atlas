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
  title: { default: "Hestia", template: "%s · Hestia" },
  description: "Your home, looked after: maintenance, projects, incidents, appliances and vendors.",
  appleWebApp: { title: "Hestia", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eeebe4" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1917" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const viewer = viewerFrom(requestHeaders) ?? { login: "", name: "You" };
  const scheme = parseColorScheme(jar.get(COLOR_SCHEME_COOKIE)?.value);

  return (
    <html lang="en" data-theme={scheme} className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full">
        <Shell
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
