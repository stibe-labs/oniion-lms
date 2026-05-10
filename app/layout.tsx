import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientOverlays from "@/components/ui/ClientOverlays";
import SplashScreen from "@/components/loading/SplashScreen";
import RootProviders from "@/app/root-providers";
import { getPlatformName, getLogoConfig, getThemeConfig } from "@/lib/platform-config";
import { buildThemeCss } from "@/lib/theme-config";
import "./globals.css";
import "katex/dist/katex.min.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [platformName, logos] = await Promise.all([getPlatformName(), getLogoConfig()]);
  const favicon = logos.faviconUrl ?? logos.logoSmallUrl ?? '/logo/main.png';
  return {
    title: `${platformName} Portal`,
    description: `${platformName} Online Classroom Portal — Live sessions, whiteboard, and real-time collaboration`,
    icons: {
      icon: favicon,
      apple: favicon,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: platformName,
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getThemeConfig();
  const themeCss = buildThemeCss(theme);
  return (
    <html lang="en" className="dark">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <RootProviders>
          <ClientOverlays />
          <SplashScreen>{children}</SplashScreen>
        </RootProviders>
      </body>
    </html>
  );
}
