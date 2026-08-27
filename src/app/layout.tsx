import type { Metadata, Viewport } from "next";
import { DM_Mono, Geist, Geist_Mono, Instrument_Serif, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const siteUrlRaw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const siteUrl =
  siteUrlRaw && /^https?:\/\//i.test(siteUrlRaw) && !siteUrlRaw.includes("[SENSITIVE]")
    ? siteUrlRaw
    : undefined;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fafaf8",
  /** Helps mobile keyboards resize layout instead of overlaying inputs */
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "moni",
    template: "%s | moni",
  },
  description:
    "Turn student ideas into action and records. AI coaching, timeline, search, Q&A, and pitch — in one place. / 学生の企画を実行と記録に。AI・タイムライン・検索・知恵袋・ピッチがひとつに。",
  openGraph: siteUrl
    ? {
        type: "website",
        locale: "ja_JP",
        alternateLocale: ["en_US"],
        url: siteUrl,
        siteName: "moni",
        title: "moni",
        description: "Turn ideas into execution and records.",
      }
    : undefined,
  twitter: {
    card: "summary_large_image",
    title: "moni",
    description: "Turn student ideas into action and records.",
  },
  applicationName: "moni",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "moni",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [{ url: "/icon", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansJp.variable} ${dmMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-dvh min-h-[100dvh] flex flex-col touch-manipulation">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
