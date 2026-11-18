import { DotGothic16, Zen_Kaku_Gothic_New } from "next/font/google";
import "./office-build.css";

const dotGothic = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic",
  display: "swap",
  preload: false,
});

const zenKaku = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-zen-kaku",
  display: "swap",
  preload: false,
});

export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${dotGothic.variable} ${zenKaku.variable} office-build-root`}>
      {children}
    </div>
  );
}
