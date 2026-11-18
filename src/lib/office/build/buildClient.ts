"use client";

import {
  buyShopItem,
  diagnoseRun,
  ensureStarterCompany,
  getGameState,
  playRun,
  previewRun,
  startRun,
  type AdlibJudge,
} from "@/lib/office/build/runService";
import { createBrowserRunStore } from "@/lib/office/build/localBuildStore";
import { STARTER_CARD_IDS } from "@/lib/office/build/content/cards";
import type { RunMode } from "@/lib/office/build/runTypes";

const GUEST = "local-guest";

let store = createBrowserRunStore();

function ensureLocalCompany() {
  if (store.getCompany(GUEST)) return;
  store.saveCompany(
    ensureStarterCompany({
      id: "local-co",
      userId: GUEST,
      name: "放課後ラボ",
      about: "文化祭向けにアプリを作る部活チームです",
      industry: "food",
      coins: 200,
      mood: "good",
      streak: 0,
      totalRevenue: 0,
      level: 1,
      stamina: 5,
      staminaUpdatedAt: new Date().toISOString(),
      tutorialDone: false,
      rankingEnabled: true,
      sfxMuted: true,
      ownerName: "カイ",
      deckIds: [...STARTER_CARD_IDS],
    }),
  );
}

export function localGameState() {
  ensureLocalCompany();
  return getGameState(store, GUEST);
}

export function localStart(mode: RunMode) {
  ensureLocalCompany();
  return startRun(store, GUEST, mode);
}

export function localDiagnose(runId: string, hypothesisId: string) {
  return diagnoseRun(store, GUEST, runId, hypothesisId);
}

export function localPreview(runId: string, playedCardIds: string[]) {
  return previewRun(store, GUEST, runId, playedCardIds);
}

export async function localPlay(
  runId: string,
  playedCardIds: string[],
  adlibText?: string,
  judge?: AdlibJudge,
) {
  return playRun(store, GUEST, runId, playedCardIds, adlibText, judge);
}

export function localBuy(itemType: "card" | "employee", id: string) {
  ensureLocalCompany();
  return buyShopItem(store, GUEST, itemType, id);
}

export function localMarkTutorialDone() {
  ensureLocalCompany();
  const c = store.getCompany(GUEST);
  if (!c) return;
  store.saveCompany({ ...c, tutorialDone: true });
}

export function localSetSfxMuted(muted: boolean) {
  ensureLocalCompany();
  const c = store.getCompany(GUEST);
  if (!c) return;
  store.saveCompany({ ...c, sfxMuted: muted });
}

export function localSetOwnerName(name: string) {
  ensureLocalCompany();
  const c = store.getCompany(GUEST);
  if (!c) return;
  store.saveCompany({ ...c, ownerName: name.slice(0, 12) });
}
