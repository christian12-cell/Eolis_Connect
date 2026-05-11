import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { SplashHider } from "@/components/ui/SplashHider";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Eolis Connect",
  description: "Plateforme de gestion des demandes clients — Eolis Cameroun",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Eolis Connect" },
};

export const viewport: Viewport = {
  themeColor: "#1B3A5C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const splashCSS = `
@keyframes splashUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
@keyframes sdBounce{0%,80%,100%{transform:scale(.6);opacity:.4;}40%{transform:scale(1);opacity:1;}}
@keyframes swMove{0%{transform:translateX(0);}100%{transform:translateX(-50%);}}
`

const splashHTML = `
<div id="eolis-splash" style="position:fixed;inset:0;z-index:9999;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;">
  <div style="color:#fff;font-size:1.875rem;font-weight:700;letter-spacing:.05em;animation:splashUp .6s ease forwards;">Eolis Connect</div>
  <div style="color:#93c5fd;font-size:.8rem;letter-spacing:.2em;text-transform:uppercase;margin-top:.4rem;animation:splashUp .6s ease .1s both;">Eolis Cameroun</div>
  <div style="display:flex;gap:.5rem;margin-top:1.5rem;">
    <div style="width:8px;height:8px;border-radius:50%;background:#60a5fa;animation:sdBounce 1.2s ease-in-out 0s infinite;"></div>
    <div style="width:8px;height:8px;border-radius:50%;background:#60a5fa;animation:sdBounce 1.2s ease-in-out .2s infinite;"></div>
    <div style="width:8px;height:8px;border-radius:50%;background:#60a5fa;animation:sdBounce 1.2s ease-in-out .4s infinite;"></div>
  </div>
  <div style="position:absolute;bottom:0;left:0;width:100%;height:160px;overflow:hidden;">
    <div style="position:absolute;bottom:0;left:0;width:200%;animation:swMove 6s linear infinite;display:flex;">
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style="width:50%;height:120px;flex-shrink:0;"><path d="M0,80 C180,140 360,20 540,80 C720,140 900,20 1080,80 C1260,140 1440,60 1440,80 L1440,160 L0,160 Z" fill="#1e3a8a" fill-opacity=".8"/></svg>
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style="width:50%;height:120px;flex-shrink:0;"><path d="M0,80 C180,140 360,20 540,80 C720,140 900,20 1080,80 C1260,140 1440,60 1440,80 L1440,160 L0,160 Z" fill="#1e3a8a" fill-opacity=".8"/></svg>
    </div>
    <div style="position:absolute;bottom:0;left:0;width:200%;animation:swMove 9s linear infinite reverse;opacity:.6;display:flex;">
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style="width:50%;height:100px;flex-shrink:0;"><path d="M0,60 C240,120 480,0 720,60 C960,120 1200,20 1440,60 L1440,160 L0,160 Z" fill="#1e40af" fill-opacity=".6"/></svg>
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style="width:50%;height:100px;flex-shrink:0;"><path d="M0,60 C240,120 480,0 720,60 C960,120 1200,20 1440,60 L1440,160 L0,160 Z" fill="#1e40af" fill-opacity=".6"/></svg>
    </div>
    <div style="position:absolute;bottom:0;left:0;width:200%;animation:swMove 12s linear infinite;opacity:.4;display:flex;">
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style="width:50%;height:80px;flex-shrink:0;"><path d="M0,40 C360,100 720,0 1080,40 C1260,70 1380,30 1440,40 L1440,160 L0,160 Z" fill="#2563eb" fill-opacity=".5"/></svg>
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style="width:50%;height:80px;flex-shrink:0;"><path d="M0,40 C360,100 720,0 1080,40 C1260,70 1380,30 1440,40 L1440,160 L0,160 Z" fill="#2563eb" fill-opacity=".5"/></svg>
    </div>
  </div>
</div>
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <style dangerouslySetInnerHTML={{ __html: splashCSS }} />
      </head>
      <body className="min-h-full font-sans">
        <div dangerouslySetInnerHTML={{ __html: splashHTML }} suppressHydrationWarning />
        <SplashHider />
        <OfflineBanner />
        {children}
        <CookieBanner />
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
          }
        `}</Script>
      </body>
    </html>
  );
}
