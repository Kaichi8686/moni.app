"use client";

import { DuoButton } from "@/components/idea-garden/DuoButton";
import { INCIDENT_TYPE_UI } from "@/lib/office/constants";
import { industryMeta } from "@/lib/office/industries";
import type { OfficeCompany, OfficeIncident } from "@/lib/office/types";

type Props = {
  incident: OfficeIncident;
  company: OfficeCompany;
  playEnter?: boolean;
  onNext: () => void;
};

function SizeStars({ size }: { size: number }) {
  const n = Math.max(1, Math.min(3, size));
  return (
    <span className="tracking-tight text-amber-500" aria-label={`大きさ ${n}`}>
      {"★".repeat(n)}
      <span className="text-zinc-300">{"☆".repeat(3 - n)}</span>
    </span>
  );
}

export function IncidentStep({ incident, company, playEnter, onNext }: Props) {
  const ui = INCIDENT_TYPE_UI[incident.type];
  const ind = industryMeta(company.industry);

  return (
    <section
      className={`overflow-hidden rounded-3xl border bg-white/90 shadow-[0_16px_48px_rgba(28,25,23,0.1)] backdrop-blur-md ${
        playEnter ? "office-incident-enter" : ""
      } ${
        incident.type === "pinch"
          ? "border-rose-200/80"
          : incident.type === "chance"
            ? "border-amber-200/80"
            : incident.type === "people"
              ? "border-sky-200/80"
              : "border-violet-200/80"
      }`}
    >
      <div className={`border-b bg-gradient-to-r px-4 py-4 ${ui.bar}`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${ui.chip}`}>{ui.label}</p>
          <SizeStars size={incident.size} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          <span aria-hidden>{ind?.icon ?? "🏢"}</span>
          <span className="truncate">{company.name}</span>
        </p>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-900">{incident.title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">{incident.description}</p>
      </div>
      <div className="p-4">
        <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={onNext}>
          作戦を考える
        </DuoButton>
      </div>
    </section>
  );
}
