import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Última Mesa",
  description: "Mesas de último momento en los mejores restaurantes. Reservar es gratis.",
  applicationName: "Última Mesa",
  appleWebApp: { capable: true, title: "Última Mesa", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ece6da",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
