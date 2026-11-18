import type { EventDef, Hypothesis } from "@/lib/office/build/content/events";
import type { CardDef } from "@/lib/office/build/content/cards";

/** クライアント向け：正解フラグを隠した事件 */
export type PublicEvent = Omit<EventDef, "hypotheses"> & {
  hypotheses: { id: string; text: string }[];
};

export function toPublicEvent(event: EventDef): PublicEvent {
  return {
    ...event,
    hypotheses: event.hypotheses.map((h) => ({ id: h.id, text: h.text })),
  };
}

export function hypothesisMultFor(event: EventDef, hypothesisId: string | null | undefined): number {
  if (!hypothesisId) return 1;
  const hit = event.hypotheses.find((h) => h.id === hypothesisId);
  return hit?.correct ? 1.3 : 1.0;
}

export function correctHypothesis(event: EventDef): Hypothesis {
  return event.hypotheses.find((h) => h.correct) ?? event.hypotheses[0]!;
}

export function publicHand(cards: CardDef[]) {
  return cards.map((c) => ({
    id: c.id,
    name: c.name,
    cost: c.cost,
    tags: c.tags,
    effect: c.effect,
    text: c.text,
    rarity: c.rarity,
  }));
}
