import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://intelar.vercel.app"),

  title: {
    default: "Intelar – AI Research Agent for Fast, Deep Insights",
    template: "%s | Intelar AI",
  },

  description:
    "Intelar is an AI research agent that automates deep research, gathers information from multiple sources, and generates structured insights for developers, students, and researchers.",

  applicationName: "Intelar",

  keywords: [
    "AI research agent",
    "automated research tool",
    "AI assistant for research",
    "deep research AI",
    "research automation tool",
    "AI knowledge assistant",
  ],

  authors: [{ name: "David Dozie" }],
  creator: "David Dozie",
  publisher: "Intelar",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "Intelar – AI Research Agent",
    description:
      "Automate deep research and generate structured insights with Intelar.",
    url: "https://intelar.vercel.app",
    siteName: "Intelar",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Intelar AI Research Agent",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Intelar – AI Research Agent",
    description:
      "AI-powered research agent for fast, structured insights.",
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
  },

  icons: {
    icon: "/favicon.ico",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Intelar",
  applicationCategory: "AIApplication",
  operatingSystem: "Web",
  description:
    "Intelar is an AI research agent that automates deep research, gathers information from multiple sources, and generates structured insights.",
  url: "https://intelar.vercel.app",
  creator: {
    "@type": "Person",
    name: "David Mgbede",
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
        <Script
          id="json-ld"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div style={{ display: "none" }}>
          Intelar is an AI research agent that automates deep research, gathers
          information from multiple sources, and generates structured insights
          for developers, students, and researchers.
        </div>

        <TooltipProvider>
          <AuthProvider>
            <QueryProvider>
              <PreferencesProvider>
                <HelpProvider>
                  <ChatProvider>
                    <ServiceWorkerRegister />
                    {children}
                    <SettingsDialog />
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
