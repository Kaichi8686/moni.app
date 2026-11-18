"use client";

import { OFFICE_CARDS } from "@/lib/office/build/content/cards";
import { OFFICE_EMPLOYEES } from "@/lib/office/build/content/employees";

type Props = {
  coins: number;
  level: number;
  ownedCards: string[];
  ownedEmployees: string[];
  onBuy: (type: "card" | "employee", id: string) => void;
  onClose: () => void;
  error?: string;
};

export function ShopStep({
  coins,
  level,
  ownedCards,
  ownedEmployees,
  onBuy,
  onClose,
  error,
}: Props) {
  const cards = OFFICE_CARDS.filter((c) => !c.starter && !ownedCards.includes(c.id));
  const emps = OFFICE_EMPLOYEES.filter((e) => !ownedEmployees.includes(e.id));

  return (
    <div className="space-y-3">
      <div className="ob-panel p-4">
        <p className="ob-title text-sm text-[var(--ob-gold)]">仕入れ</p>
        <p className="mt-1 text-xs text-[var(--ob-muted)]">
          所持コイン {coins.toLocaleString("ja-JP")}
        </p>
        {error ? <p className="mt-2 text-xs font-bold text-[#ff8a8a]">{error}</p> : null}
      </div>
      <div className="ob-panel p-3">
        <p className="mb-2 text-[11px] font-bold text-[var(--ob-muted)]">カード</p>
        <ul className="space-y-2">
          {cards.slice(0, 8).map((c) => {
            const price = c.rarity === "epic" ? 800 : c.rarity === "rare" ? 400 : 200;
            const locked = level < c.unlockLevel;
            return (
              <li key={c.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-[11px] text-[var(--ob-muted)]">
                    {c.text}
                    {locked ? ` · Lv${c.unlockLevel}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="ob-btn shrink-0 px-2 py-1 text-xs"
                  disabled={locked || coins < price}
                  onClick={() => onBuy("card", c.id)}
                >
                  {price}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="ob-panel p-3">
        <p className="mb-2 text-[11px] font-bold text-[var(--ob-muted)]">社員</p>
        <ul className="space-y-2">
          {emps.map((e) => (
            <li key={e.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{e.name}</p>
                <p className="text-[11px] text-[var(--ob-muted)]">{e.role}</p>
              </div>
              <button
                type="button"
                className="ob-btn shrink-0 px-2 py-1 text-xs"
                disabled={coins < e.price}
                onClick={() => onBuy("employee", e.id)}
              >
                {e.price}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="ob-btn-ghost w-full" onClick={onClose}>
        オフィスに戻る
      </button>
    </div>
  );
}
