import { OFFICE_MAX_STAMINA, OFFICE_STAMINA_RECOVER_MS } from "@/lib/office/constants";
import type { StaminaState } from "@/lib/office/types";

/** 保存値から「いまのスタミナ」を計算（cron不要） */
export function computeStamina(
  stored: number,
  updatedAt: Date,
  now: Date = new Date(),
): StaminaState {
  const clamped = Math.max(0, Math.min(OFFICE_MAX_STAMINA, Math.floor(stored)));
  if (clamped >= OFFICE_MAX_STAMINA) {
    return { value: OFFICE_MAX_STAMINA, updatedAt: now, nextRecoverAt: null };
  }

  const elapsed = Math.max(0, now.getTime() - updatedAt.getTime());
  const gained = Math.floor(elapsed / OFFICE_STAMINA_RECOVER_MS);
  if (gained <= 0) {
    return {
      value: clamped,
      updatedAt,
      nextRecoverAt: new Date(updatedAt.getTime() + OFFICE_STAMINA_RECOVER_MS),
    };
  }

  const value = Math.min(OFFICE_MAX_STAMINA, clamped + gained);
  if (value >= OFFICE_MAX_STAMINA) {
    return { value: OFFICE_MAX_STAMINA, updatedAt: now, nextRecoverAt: null };
  }

  const newUpdatedAt = new Date(updatedAt.getTime() + gained * OFFICE_STAMINA_RECOVER_MS);
  return {
    value,
    updatedAt: newUpdatedAt,
    nextRecoverAt: new Date(newUpdatedAt.getTime() + OFFICE_STAMINA_RECOVER_MS),
  };
}

/** 1消費後の保存値。満タンからの消費はタイマーを now にリセット */
export function consumeStamina(
  stored: number,
  updatedAt: Date,
  now: Date = new Date(),
): { ok: true; state: StaminaState } | { ok: false; state: StaminaState } {
  const current = computeStamina(stored, updatedAt, now);
  if (current.value < 1) return { ok: false, state: current };

  const value = current.value - 1;
  const wasFull = current.value >= OFFICE_MAX_STAMINA;
  const nextUpdatedAt = wasFull || value >= OFFICE_MAX_STAMINA ? now : current.updatedAt;
  const state: StaminaState = {
    value,
    updatedAt: nextUpdatedAt,
    nextRecoverAt:
      value >= OFFICE_MAX_STAMINA
        ? null
        : new Date(nextUpdatedAt.getTime() + OFFICE_STAMINA_RECOVER_MS),
  };
  return { ok: true, state };
}

export function formatStaminaDots(value: number, max = OFFICE_MAX_STAMINA): string {
  const filled = Math.max(0, Math.min(max, value));
  return "●".repeat(filled) + "○".repeat(max - filled);
}

export function msUntil(date: Date | null, now = new Date()): number | null {
  if (!date) return null;
  return Math.max(0, date.getTime() - now.getTime());
}

export function formatRemainMmSs(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
