import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fafafa",
};

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: "moni — 学生の企画と実行を加速",
  description:
    "起業・探究に本気の学生向け。AIで壁打ち、タイムラインで発信、検索とチャットで仲間とつながり、知恵袋とピッチで検証。行動と記録をひとつの場所に。",
  openGraph: siteUrl
    ? {
        type: "website",
        locale: "ja_JP",
        url: siteUrl,
        siteName: "moni",
        title: "moni — 学生の企画と実行を加速",
        description:
          "企画を実行と記録に変える。AI・タイムライン・マッチング・知恵袋・ピッチがひとつの場所に。",
      }
    : undefined,
  twitter: {
    card: "summary_large_image",
    title: "moni — 学生の企画と実行を加速",
    description: "企画を実行と記録に変える学生向けプラットフォーム。",
  },
  applicationName: "moni",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh min-h-[100dvh] flex flex-col touch-manipulation">
        {children}
      </body>
    </html>
  );
}
