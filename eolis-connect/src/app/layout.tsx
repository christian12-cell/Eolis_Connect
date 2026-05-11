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
#eolis-splash {
  position: fixed; inset: 0; z-index: 9999;
  background: #0f172a;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  overflow: hidden;
}
#splash-title {
  color: #fff; font-size: 1.875rem; font-weight: 700;
  letter-spacing: 0.05em;
  animation: splashUp 0.6s ease forwards;
}
#splash-sub {
  color: #93c5fd; font-size: 0.8rem;
  letter-spacing: 0.2em; text-transform: uppercase;
  margin-top: 0.4rem;
  animation: splashUp 0.6s ease 0.1s both;
}
#splash-dots { display: flex; gap: 0.5rem; margin-top: 1.5rem; }
.sd {
  width: 8px; height: 8px; border-radius: 50%; background: #60a5fa;
}
.sd:nth-child(1){animation:sdBounce 1.2s ease-in-out 0s infinite;}
.sd:nth-child(2){animation:sdBounce 1.2s ease-in-out 0.2s infinite;}
.sd:nth-child(3){animation:sdBounce 1.2s ease-in-out 0.4s infinite;}
#splash-waves { position:absolute; bottom:0; left:0; width:100%; height:160px; overflow:hidden; }
.sw { position:absolute; bottom:0; left:0; width:200%; display:flex; }
.sw svg { width:50%; flex-shrink:0; }
.sw1 { animation: swMove 6s linear infinite; }
.sw2 { animation: swMove 9s linear infinite reverse; opacity:.6; }
.sw3 { animation: swMove 12s linear infinite; opacity:.4; }
@keyframes splashUp {
  from{opacity:0;transform:translateY(16px);}
  to{opacity:1;transform:translateY(0);}
}
@keyframes sdBounce {
  0%,80%,100%{transform:scale(.6);opacity:.4;}
  40%{transform:scale(1);opacity:1;}
}
@keyframes swMove {
  0%{transform:translateX(0);}
  100%{transform:translateX(-50%);}
}
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
        {/* Pure HTML/CSS splash — visible before JS loads */}
        <div id="eolis-splash">
          <div id="splash-title">Eolis Connect</div>
          <div id="splash-sub">Eolis Cameroun</div>
          <div id="splash-dots">
            <div className="sd" /><div className="sd" /><div className="sd" />
          </div>
          <div id="splash-waves">
            <div className="sw sw1">
              <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{height:'120px'}}>
                <path d="M0,80 C180,140 360,20 540,80 C720,140 900,20 1080,80 C1260,140 1440,60 1440,80 L1440,160 L0,160 Z" fill="#1e3a8a" fillOpacity="0.8"/>
              </svg>
              <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{height:'120px'}}>
                <path d="M0,80 C180,140 360,20 540,80 C720,140 900,20 1080,80 C1260,140 1440,60 1440,80 L1440,160 L0,160 Z" fill="#1e3a8a" fillOpacity="0.8"/>
              </svg>
            </div>
            <div className="sw sw2">
              <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{height:'100px'}}>
                <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,20 1440,60 L1440,160 L0,160 Z" fill="#1e40af" fillOpacity="0.6"/>
              </svg>
              <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{height:'100px'}}>
                <path d="M0,60 C240,120 480,0 720,60 C960,120 1200,20 1440,60 L1440,160 L0,160 Z" fill="#1e40af" fillOpacity="0.6"/>
              </svg>
            </div>
            <div className="sw sw3">
              <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{height:'80px'}}>
                <path d="M0,40 C360,100 720,0 1080,40 C1260,70 1380,30 1440,40 L1440,160 L0,160 Z" fill="#2563eb" fillOpacity="0.5"/>
              </svg>
              <svg viewBox="0 0 1440 160" preserveAspectRatio="none" style={{height:'80px'}}>
                <path d="M0,40 C360,100 720,0 1080,40 C1260,70 1380,30 1440,40 L1440,160 L0,160 Z" fill="#2563eb" fillOpacity="0.5"/>
              </svg>
            </div>
          </div>
        </div>

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
