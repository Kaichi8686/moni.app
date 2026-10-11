import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import "./shift.css";

const zenMaru = Zen_Maru_Gothic({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-shift",
  display: "swap",
});

const title = "シフトメイキング";
const description =
  "文化祭のシフトを、みんなの希望（○△×）から自動で割り振るツール。グループLINEにリンクを送って集められます。";

export const metadata: Metadata = {
  title: {
    default: title,
    template: `%s | ${title}`,
  },
  description,
  applicationName: title,
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: title,
    title,
    description,
    images: [
      {
        url: "/api/shift/og",
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/api/shift/og"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d7377",
  viewportFit: "cover",
};

export default function ShiftLayout({ children }: { children: React.ReactNode }) {
  return <div className={`shift-root ${zenMaru.variable}`}>{children}</div>;
}
