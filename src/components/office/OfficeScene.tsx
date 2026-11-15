"use client";

import type { OfficeIndustry } from "@/lib/office/industries";
import { parseOfficeIndustry } from "@/lib/office/industries";

type Props = {
  level: number;
  industry: OfficeIndustry | null;
  /** pinch | chance | people | rival | null */
  fx?: string | null;
};

function workerCount(level: number): number {
  if (level <= 1) return 2;
  if (level === 2) return 3;
  return 4;
}

function IndustryProps({ industry }: { industry: OfficeIndustry | null }) {
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
          <rect x="262" y="86" width="26" height="16" rx="2" fill="#A1A1AA" />
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
    <g transform={`translate(${x} 0)`}>
      <g
        className={`office-worker ${panic ? "office-worker--panic" : ""} ${jump ? "office-worker--jump" : ""}`}
        style={{ ["--office-delay" as string]: delay }}
      >
        <ellipse cx="0" cy="118" rx="14" ry="4" fill="#00000014" />
        <rect className="office-desk" x="-22" y="96" width="44" height="10" rx="2" fill="#E7E5E4" />
        <rect className="office-monitor" x="-10" y="78" width="20" height="14" rx="2" fill="#94A3B8" />
        <rect x="-8" y="78" width="16" height="20" rx="4" fill="#FB923C" />
        <g className="office-head">
          <circle cx="0" cy="66" r="9" fill="#FED7AA" />
          {think ? (
            <g className="office-think">
              <circle cx="12" cy="52" r="2.2" fill="#A1A1AA" />
              <circle cx="16" cy="46" r="2.8" fill="#A1A1AA" />
              <circle cx="20" cy="38" r="3.5" fill="#A1A1AA" />
            </g>
          ) : null}
        </g>
        <g className="office-arms">
          <rect x="-14" y="88" width="10" height="4" rx="2" fill="#FED7AA" />
          <rect x="4" y="88" width="10" height="4" rx="2" fill="#FED7AA" />
        </g>
        <g className="office-mug">
          <rect x="14" y="90" width="8" height="8" rx="1.5" fill="#fff" stroke="#D6D3D1" />
          <path
            d="M18 88 c4 -6 8 -6 8 0"
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

export function OfficeScene({ level, industry, fx }: Props) {
  const n = workerCount(level);
  const xs = n === 2 ? [70, 150] : n === 3 ? [55, 110, 165] : [42, 90, 138, 186];
  const delays = ["0s", "0.35s", "0.7s", "1.1s"];

  return (
    <div
      className={`office-scene overflow-hidden rounded-2xl ${fx ? `office-fx--${fx}` : ""}`}
      style={{ height: 160 }}
    >
      <svg viewBox="0 0 320 160" className="h-full w-full" role="img" aria-label="オフィス">
        <defs>
          <linearGradient id="officeWall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFF7ED" />
            <stop offset="100%" stopColor="#FFEDD5" />
          </linearGradient>
        </defs>
        <rect width="320" height="160" fill="url(#officeWall)" />
        <rect x="0" y="120" width="320" height="40" fill="#F5F5F4" />
        <rect x="18" y="28" width="36" height="28" rx="3" fill="#FEF3C7" stroke="#FDE68A" />
        <IndustryProps industry={industry} />
        <g className="office-rival-shadow" opacity="0">
          <ellipse cx="20" cy="125" rx="18" ry="6" fill="#00000055" />
          <path d="M8 125 L20 70 L32 125 Z" fill="#18181B" opacity="0.55" />
        </g>
        <g className="office-sparkles" opacity="0">
          <circle cx="40" cy="40" r="3" fill="#FBBF24" />
          <circle cx="90" cy="28" r="2.5" fill="#FDE68A" />
          <circle cx="200" cy="36" r="3" fill="#F59E0B" />
          <circle cx="260" cy="48" r="2" fill="#FBBF24" />
        </g>
        <g className="office-bang" opacity="0">
          <circle cx="160" cy="36" r="16" fill="#FEE2E2" />
          <text x="160" y="42" textAnchor="middle" fontSize="18" fontWeight="800" fill="#E11D48">
            ！
          </text>
        </g>
        <g className="office-bang-gold" opacity="0">
          <circle cx="160" cy="36" r="16" fill="#FEF3C7" />
          <text x="160" y="42" textAnchor="middle" fontSize="18" fontWeight="800" fill="#D97706">
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
