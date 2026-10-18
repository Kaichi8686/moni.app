import type { Metadata, Viewport } from "next";
import { Shippori_Mincho_B1, IBM_Plex_Sans_JP } from "next/font/google";
import "./bunkasai-shift.css";

const display = Shippori_Mincho_B1({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-bunkasai-display",
  display: "swap",
});

const sans = IBM_Plex_Sans_JP({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-bunkasai-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "文化祭シフト",
  description:
    "NG時間帯を考慮して各コマ9人を自動割り振りする、文化祭シフト管理モックアップ。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e7c7b",
};

export default function BunkasaiShiftLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${display.variable} ${sans.variable} font-[family-name:var(--font-bunkasai-sans)]`}>
      {children}
    </div>
  );
}
