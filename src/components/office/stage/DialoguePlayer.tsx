"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { StageView } from "@/components/office/stage/StageView";
import { castMemberByRole, type CastMember } from "@/lib/office/cast";
import type { OfficeIndustry } from "@/lib/office/industries";
import {
  applyNamePlaceholders,
  type IncidentMission,
  type ScriptAction,
  type ScriptBeat,
} from "@/lib/office/script";
import type { OfficeSceneId } from "@/lib/office/scenes";

type Props = {
  script: ScriptBeat[];
  mission: IncidentMission;
  cast: CastMember[];
  level: number;
  industry: OfficeIndustry | null;
  baseScene?: OfficeSceneId | null;
  /** true なら台本を飛ばしてミッションから */
  skipPlayback?: boolean;
  onListen: () => void;
};

const CHAR_MS = 30;

export function DialoguePlayer({
  script,
  mission,
  cast,
  level,
  industry,
  baseScene,
  skipPlayback,
  onListen,
}: Props) {
  const reduce = useReducedMotion();
  const beats = useMemo(
    () =>
      script.map((b) => ({
        ...b,
        line: applyNamePlaceholders(b.line, cast),
      })),
    [script, cast],
  );

  const [idx, setIdx] = useState(skipPlayback || reduce ? beats.length : 0);
  const [shown, setShown] = useState(
    skipPlayback || reduce ? beats[beats.length - 1]?.line.length ?? 0 : 0,
  );
  const [done, setDone] = useState(Boolean(skipPlayback || reduce));

  const beat = idx < beats.length ? beats[idx]! : null;
  const full = beat?.line ?? "";
  const typing = Boolean(beat && shown < full.length && !reduce);

  useEffect(() => {
    if (done || reduce || skipPlayback || !beat) return;
    if (shown >= full.length) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), CHAR_MS);
    return () => window.clearTimeout(id);
  }, [beat, shown, full.length, done, reduce, skipPlayback]);

  function advance() {
    if (!beat) {
      setDone(true);
      return;
    }
    if (typing) {
      setShown(full.length);
      return;
    }
    if (idx >= beats.length - 1) {
      setDone(true);
      setIdx(beats.length);
      return;
    }
    setIdx((i) => i + 1);
    setShown(0);
  }

  function skipAll() {
    setIdx(beats.length);
    setShown(full.length);
    setDone(true);
  }

  const speaker = beat ? castMemberByRole(cast, beat.actor) : null;
  const scene = beat?.scene || baseScene || null;
  const action: ScriptAction | null = beat && !reduce ? beat.action : null;
  const speech = beat ? full.slice(0, shown) : null;

  return (
    <div className="space-y-3">
      <div
        role="presentation"
        onClick={done ? undefined : advance}
        className={done ? undefined : "cursor-pointer"}
      >
        <StageView
          level={level}
          industry={industry}
          scene={scene}
          speaker={speaker}
          emotion={beat?.emotion}
          speech={speech}
          enter={!reduce && beat?.action === "enter"}
          action={action}
        />
      </div>

      {!done ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[11px] font-medium text-zinc-400">
            {typing ? "タップで全文" : "タップで次へ"}
          </p>
          <button
            type="button"
            onClick={skipAll}
            className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-zinc-500 hover:bg-zinc-100"
          >
            スキップ
          </button>
        </div>
      ) : (
        <section className="space-y-3 rounded-3xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/80 p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
            ミッション
          </p>
          <div>
            <p className="text-xs font-bold text-zinc-500">目標</p>
            <p className="mt-0.5 text-sm font-black text-zinc-900">{mission.goal}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-500">制約</p>
            <p className="mt-0.5 text-sm font-semibold text-zinc-700">{mission.constraint}</p>
          </div>
          <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={onListen}>
            話を聞く
          </DuoButton>
        </section>
      )}
    </div>
  );
}
