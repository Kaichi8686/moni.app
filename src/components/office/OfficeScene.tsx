"use client";

import { useId } from "react";
import type { OfficeIndustry } from "@/lib/office/industries";
import { parseOfficeIndustry } from "@/lib/office/industries";

type Props = {
  level: number;
  industry: OfficeIndustry | null;
  /** pinch | chance | people | rival | null */
  fx?: string | null;
  /** card: 埋め込み / backdrop: 全画面背景 */
  variant?: "card" | "backdrop";
};

function workerCount(level: number): number {
  if (level <= 1) return 2;
  if (level === 2) return 3;
  return 4;
}

function IndustryProps({
  industry,
  uid,
}: {
  industry: OfficeIndustry | null;
  uid: string;
}) {
  const id = parseOfficeIndustry(industry);
  switch (id) {
    case "food":
      return (
        <g aria-hidden>
          <rect x="248" y="78" width="52" height="36" rx="4" fill="#D6D3D1" />
          <rect x="254" y="70" width="18" height="12" rx="2" fill="#78716C" />
          <circle cx="288" y="88" r="7" fill="#44403C" />
          <path
            d="M288 78 c6 -10 14 -10 14 0"
            fill="none"
            stroke="#A8A29E"
            strokeWidth="2"
            className="office-steam"
          />
        </g>
      );
    case "fashion":
      return (
        <g aria-hidden>
          <line x1="250" y1="72" x2="300" y2="72" stroke="#A8A29E" strokeWidth="3" />
          <path
            d="M258 72 v28 M270 72 v28 M282 72 v28 M294 72 v28"
            stroke="#FDBA74"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>
      );
    case "tech":
      return (
        <g aria-hidden>
          <rect x="246" y="68" width="58" height="40" rx="4" fill="#1E293B" />
          <rect x="252" y="74" width="46" height="28" rx="2" fill="#38BDF8" opacity="0.85" />
          <rect x="262" y="112" width="28" height="10" rx="3" fill="#64748B" />
          <circle cx="270" cy="88" r="2" fill="#F8FAFC" className="office-rec-dot" />
        </g>
      );
    case "event":
      return (
        <g aria-hidden>
          <path d="M248 110 L275 68 L302 110 Z" fill="#FDBA74" />
          <rect x="268" y="110" width="14" height="18" fill="#B45309" />
          <circle cx="275" cy="92" r="5" fill="#FDE68A" />
        </g>
      );
    case "shop":
      return (
        <g aria-hidden>
          <rect x="248" y="88" width="56" height="28" rx="4" fill="#FEF3C7" stroke="#F59E0B" />
          <rect x="256" y="78" width="12" height="10" rx="2" fill="#FCD34D" />
          <rect x="274" y="74" width="14" height="14" rx="2" fill="#FB923C" />
          <rect x="292" y="80" width="10" height="8" rx="2" fill="#FDE68A" />
        </g>
      );
    case "media":
      return (
        <g aria-hidden>
          <rect x="250" y="72" width="22" height="36" rx="4" fill="#18181B" />
          <rect x="254" y="78" width="14" height="24" rx="2" fill="#38BDF8" />
          <rect x="280" y="80" width="26" height="18" rx="3" fill="#F4F4F5" stroke="#D4D4D8" />
          <circle cx="293" cy="89" r="3" fill="#F43F5E" className="office-rec-dot" />
        </g>
      );
    case "learn":
      return (
        <g aria-hidden>
          <rect x="250" y="70" width="48" height="36" rx="3" fill="#FEF3C7" stroke="#F59E0B" />
          <path d="M258 78 h32 M258 86 h28 M258 94 h24" stroke="#B45309" strokeWidth="2" />
          <rect x="286" y="100" width="14" height="18" rx="1" fill="#FDBA74" />
        </g>
      );
    case "health":
      return (
        <g aria-hidden>
          <circle cx="275" cy="88" r="22" fill="none" stroke="#86EFAC" strokeWidth="4" />
          <circle cx="275" cy="88" r="8" fill="#22C55E" />
          <rect x="252" y="108" width="46" height="8" rx="2" fill="#A7F3D0" />
        </g>
      );
    case "community":
      return (
        <g aria-hidden>
          <rect x="250" y="86" width="20" height="28" rx="2" fill="#FED7AA" />
          <rect x="274" y="78" width="24" height="36" rx="2" fill="#FDBA74" />
          <path d="M248 86 L260 72 L272 86" fill="#FB923C" />
          <path d="M272 78 L286 62 L300 78" fill="#F97316" />
        </g>
      );
    default:
      return (
        <g aria-hidden>
          <rect x="255" y="80" width="40" height="28" rx="3" fill="#E4E4E7" />
          <rect x="262" y="86" width="26" height="16" rx="2" fill={`url(#${uid}-screen)`} />
          <circle cx="275" cy="94" r="2" fill="#F8FAFC" className="office-rec-dot" />
        </g>
      );
  }
}

function Worker({
  x,
  delay,
  panic,
  jump,
  think,
}: {
  x: number;
  delay: string;
  panic?: boolean;
  jump?: boolean;
  think?: boolean;
}) {
  return (
    <g transform={`translate(${x} 48)`}>
      <g
        className={`office-worker ${panic ? "office-worker--panic" : ""} ${jump ? "office-worker--jump" : ""}`}
        style={{ ["--office-delay" as string]: delay }}
      >
        <ellipse cx="0" cy="118" rx="18" ry="5" fill="#00000014" />
        <rect className="office-desk" x="-28" y="96" width="56" height="12" rx="2" fill="#E7E5E4" />
        <rect className="office-monitor" x="-12" y="76" width="24" height="16" rx="2" fill="#94A3B8" />
        <rect x="-10" y="78" width="20" height="24" rx="5" fill="#FB923C" />
        <g className="office-head">
          <circle cx="0" cy="64" r="11" fill="#FED7AA" />
          {think ? (
            <g className="office-think">
              <circle cx="14" cy="48" r="2.6" fill="#A1A1AA" />
              <circle cx="19" cy="40" r="3.2" fill="#A1A1AA" />
              <circle cx="24" cy="30" r="4" fill="#A1A1AA" />
            </g>
          ) : null}
        </g>
        <g className="office-arms">
          <rect x="-18" y="90" width="12" height="5" rx="2" fill="#FED7AA" />
          <rect x="6" y="90" width="12" height="5" rx="2" fill="#FED7AA" />
        </g>
        <g className="office-mug">
          <rect x="18" y="92" width="10" height="10" rx="2" fill="#fff" stroke="#D6D3D1" />
          <path
            d="M23 90 c5 -7 10 -7 10 0"
            fill="none"
            stroke="#A8A29E"
            strokeWidth="1.5"
            className="office-steam"
          />
        </g>
      </g>
    </g>
  );
}

export function OfficeScene({ level, industry, fx, variant = "card" }: Props) {
  const uid = useId().replace(/:/g, "");
  const n = workerCount(level);
  const xs = n === 2 ? [120, 260] : n === 3 ? [90, 200, 310] : [70, 160, 250, 340];
  const delays = ["0s", "0.35s", "0.7s", "1.1s"];
  const backdrop = variant === "backdrop";

  return (
    <div
      className={`office-scene overflow-hidden ${
        backdrop
          ? "absolute inset-0 h-full w-full rounded-none ring-0"
          : "relative h-[168px] min-h-[168px] w-full rounded-2xl ring-1 ring-amber-100 md:h-full md:min-h-[200px]"
      } ${fx ? `office-fx--${fx}` : ""}`}
      aria-hidden={backdrop || undefined}
    >
      <svg
        viewBox="0 0 480 220"
        className="absolute inset-0 h-full w-full"
        role={backdrop ? "presentation" : "img"}
        aria-label={backdrop ? undefined : "オフィスの様子"}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={`${uid}-wall`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF7ED" />
            <stop offset="100%" stopColor="#FFEDD5" />
          </linearGradient>
          <linearGradient id={`${uid}-screen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <linearGradient id={`${uid}-shaft`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="480" height="220" fill={`url(#${uid}-wall)`} />
        <rect x="0" y="168" width="480" height="52" fill="#F5F5F4" />

        {/* ambient background motion */}
        <g aria-hidden>
          <path
            className="office-light-shaft"
            d="M28 28 L110 168 L170 168 L78 28 Z"
            fill={`url(#${uid}-shaft)`}
          />
          <rect
            className="office-window-glow"
            x="28"
            y="24"
            width="64"
            height="52"
            rx="4"
            fill="#FEF3C7"
            stroke="#FDE68A"
          />
          <path d="M60 24 v52 M28 50 h64" stroke="#FCD34D" strokeWidth="2" opacity="0.7" />
          <rect
            className="office-paper"
            x="250"
            y="48"
            width="22"
            height="16"
            rx="2"
            fill="#FFFBEB"
            stroke="#FDE68A"
            opacity="0.9"
          />
          <circle className="office-mote office-mote--a" cx="120" cy="70" r="2.2" fill="#F59E0B" />
          <circle className="office-mote office-mote--b" cx="200" cy="42" r="1.8" fill="#FB923C" />
          <circle className="office-mote office-mote--c" cx="340" cy="60" r="2.4" fill="#FBBF24" />
          <circle className="office-mote office-mote--d" cx="410" cy="88" r="1.6" fill="#F59E0B" />
          <circle className="office-mote office-mote--e" cx="160" cy="100" r="2" fill="#FDE68A" />
        </g>

        <g transform="translate(80 20) scale(1.15)">
          <IndustryProps industry={industry} uid={uid} />
        </g>

        <g className="office-rival-shadow" opacity="0">
          <ellipse cx="36" cy="180" rx="24" ry="8" fill="#00000055" />
          <path d="M18 180 L36 100 L54 180 Z" fill="#18181B" opacity="0.55" />
        </g>
        <g className="office-sparkles" opacity="0">
          <circle cx="70" cy="50" r="4" fill="#FBBF24" />
          <circle cx="140" cy="36" r="3.2" fill="#FDE68A" />
          <circle cx="300" cy="48" r="4" fill="#F59E0B" />
          <circle cx="390" cy="64" r="2.8" fill="#FBBF24" />
        </g>
        <g className="office-bang" opacity="0">
          <circle cx="240" cy="50" r="22" fill="#FEE2E2" />
          <text x="240" y="58" textAnchor="middle" fontSize="24" fontWeight="800" fill="#E11D48">
            ！
          </text>
        </g>
        <g className="office-bang-gold" opacity="0">
          <circle cx="240" cy="50" r="22" fill="#FEF3C7" />
          <text x="240" y="58" textAnchor="middle" fontSize="24" fontWeight="800" fill="#D97706">
            ！
          </text>
        </g>
        {xs.map((x, i) => (
          <Worker
            key={`${x}-${i}`}
            x={x}
            delay={delays[i] ?? "0s"}
            panic={fx === "pinch"}
            jump={fx === "chance"}
            think={fx === "people" && i === 0}
          />
        ))}
      </svg>
    </div>
  );
}
