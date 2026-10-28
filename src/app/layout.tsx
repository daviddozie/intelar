import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import AIAllowanceDialog from "@/components/ai-allowance-dialog";
import SettingsDialog from "@/components/settings-dialog";
import HelpDialog from "@/components/help-dialog";
import { PreferencesProvider } from "@/context/preferences-context";
import { HelpProvider } from "@/context/help-context";
import AuthProvider from "@/components/auth-provider";
import QueryProvider from "@/components/query-provider";
import { ChatProvider } from "@/context/chat-context";
import ServiceWorkerRegister from "@/components/service-worker-register";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_URL, SITE_DESCRIPTION, privateRobots } from "@/lib/seo";
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
  metadataBase: new URL(SITE_URL),
  title: { default: "Intelar — Research, learning, and collaboration", template: "%s | Intelar" },
  description: SITE_DESCRIPTION,
  applicationName: "Intelar",
  creator: "David Mgbede",
  publisher: "Intelar",
  robots: privateRobots,
  icons: { icon: "/favicon.ico" },
  manifest: "/manifest.json",
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var cached=JSON.parse(localStorage.getItem("intelar_preferences:guest")||"null");var saved=cached&&cached.preferences?cached.preferences.theme:localStorage.getItem("theme");var dark=saved==="dark"||(saved!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.classList.toggle("dark",dark);root.style.colorScheme=dark?"dark":"light";var motion=cached&&cached.preferences?cached.preferences.motion:"system";root.dataset.motion=motion;root.dataset.reducedMotion=String(motion==="reduced"||(motion!=="full"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches));}catch(_){}})();`}
        </Script>
        <TooltipProvider>
          <AuthProvider>
            <QueryProvider>
              <PreferencesProvider>
                <HelpProvider>
                  <ChatProvider>
                    <ServiceWorkerRegister />
                    {children}
                    <SettingsDialog />
                    <AIAllowanceDialog />
                    <HelpDialog />
                    <Toaster position="top-center" />
                  </ChatProvider>
                </HelpProvider>
              </PreferencesProvider>
            </QueryProvider>
          </AuthProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
