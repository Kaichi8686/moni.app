"use client";

import { useMemo, useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { loadGarden } from "@/lib/idea-garden/storage";
import type { PlantedIdea } from "@/lib/idea-garden/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  userId: string;
  currentTitle?: string;
  currentBody?: string;
  onOpenGarden: () => void;
  onSave: (input: { plantId: string; title: string; body: string }) => Promise<void>;
};

export function LeaguePromptComposer({
  userId,
  currentTitle,
  currentBody,
  onOpenGarden,
  onSave,
}: Props) {
  const { locale, tx } = useI18n();
  const seeds = useMemo(() => {
    const garden = loadGarden(userId === "local-guest" ? null : userId);
    return [...garden.plants].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [userId]);

  const [plantId, setPlantId] = useState(seeds[0]?.id ?? "");
  const [title, setTitle] = useState(currentTitle ?? "");
  const [body, setBody] = useState(currentBody ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const selected: PlantedIdea | undefined = seeds.find((s) => s.id === plantId);

  function fillFromSeed(plant: PlantedIdea) {
    setPlantId(plant.id);
    if (!title.trim()) setTitle(plant.title.slice(0, 80));
    if (!body.trim()) {
      setBody(
        locale === "en"
          ? `Inspired by the flower seed “${plant.title}”: ${plant.answer}`
          : `花の種「${plant.title}」から：${plant.answer}`,
      );
    }
  }

  if (seeds.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-black text-zinc-900">
          {tx("リーグのお題を書く", "Write the league prompt")}
        </h2>
        <p className="mt-2 text-sm font-medium text-zinc-600">
          {tx(
            "お題は花を開いて得た種から作ります。まず花タブで今日の花を咲かせてください。",
            "Prompts come from flower seeds. Open today’s flower in the Grow tab first.",
          )}
        </p>
        <div className="mt-3">
          <DuoButton type="button" tone="orange" size="md" fullWidth onClick={onOpenGarden}>
            {tx("花を開く", "Open a flower")}
          </DuoButton>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-black text-zinc-900">
        {tx("リーグのお題を書く", "Write the league prompt")}
      </h2>
      <p className="mt-1 text-xs font-medium text-zinc-500">
        {tx(
          "開いた花の種を選び、今週の共通お題に仕上げます。",
          "Pick a seed from an opened flower and craft this week’s shared prompt.",
        )}
      </p>

      <label className="mt-3 block">
        <span className="text-xs font-bold text-zinc-600">{tx("もとになる種", "Seed source")}</span>
        <select
          value={plantId}
          onChange={(e) => {
            const next = seeds.find((s) => s.id === e.target.value);
            setPlantId(e.target.value);
            if (next) fillFromSeed(next);
          }}
          className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#FF9600]"
        >
          {seeds.map((s) => (
            <option key={s.id} value={s.id}>
              {s.gold ? "✨ " : ""}
              {s.title}
            </option>
          ))}
        </select>
      </label>

      {selected ? (
        <p className="mt-2 rounded-2xl bg-zinc-50 px-3 py-2 text-xs font-medium leading-relaxed text-zinc-600">
          {selected.answer}
        </p>
      ) : null}

      <label className="mt-3 block">
        <span className="text-xs font-bold text-zinc-600">{tx("お題タイトル", "Prompt title")}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#FF9600]"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-bold text-zinc-600">{tx("お題の説明", "Prompt details")}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FF9600]"
        />
      </label>

      {msg ? <p className="mt-2 text-sm font-semibold text-emerald-700">{msg}</p> : null}

      <div className="mt-3">
        <DuoButton
          type="button"
          tone="orange"
          size="lg"
          fullWidth
          disabled={busy || !plantId || !title.trim() || !body.trim()}
          onClick={() => {
            void (async () => {
              setBusy(true);
              setMsg("");
              try {
                await onSave({ plantId, title: title.trim(), body: body.trim() });
                setMsg(tx("お題を保存しました", "Prompt saved"));
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {busy ? tx("保存中…", "Saving…") : tx("お題を保存する", "Save prompt")}
        </DuoButton>
      </div>
    </section>
  );
}
