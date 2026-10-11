import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import "./bunkasai.css";

const rounded = Zen_Maru_Gothic({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-bunkasai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "文化祭シフト",
  description: "同じリンクを開いて、入りたい時間帯をタップするだけ。ログイン不要。",
  openGraph: {
    title: "文化祭シフト",
    description: "4つの時間帯から選ぶだけ。定員9人×4枠。",
    locale: "ja_JP",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ff8a3d",
  viewportFit: "cover",
};

export default function BunkasaiLayout({ children }: { children: React.ReactNode }) {
  return <div className={`bunkasai-root ${rounded.variable}`}>{children}</div>;
}
