"use client";

import { EDITABLE_CAST_ROLES, validateCastName, validateOwnerName } from "@/lib/office/castValidate";
import type { CastMember } from "@/lib/office/cast";
import type { CastRole } from "@/lib/office/scenes";

const ROLE_LABEL: Record<(typeof EDITABLE_CAST_ROLES)[number], string> = {
  newbie: "新人",
  veteran: "ベテラン",
  accountant: "経理",
  regular: "一般社員",
};

const HAIR_OPTS = [
  { v: 0, label: "黒髪" },
  { v: 1, label: "茶髪" },
  { v: 2, label: "金髪" },
  { v: 3, label: "赤み" },
];

const COLOR_OPTS = [
  { v: 0, label: "オレンジ" },
  { v: 1, label: "水色" },
  { v: 2, label: "むらさき" },
  { v: 3, label: "みどり" },
];

export type CastSetupValue = {
  ownerName: string;
  members: CastMember[];
};

type Props = {
  value: CastSetupValue;
  onChange: (next: CastSetupValue) => void;
  /** 埋め込み時は見出しを小さく */
  compact?: boolean;
};

export function CastSetup({ value, onChange, compact }: Props) {
  function patchMember(role: CastRole, patch: Partial<CastMember>) {
    onChange({
      ...value,
      members: value.members.map((m) => (m.role === role ? { ...m, ...patch } : m)),
    });
  }

  const editable = value.members.filter((m) =>
    (EDITABLE_CAST_ROLES as readonly string[]).includes(m.role),
  );

  return (
    <div className="space-y-4">
      {!compact ? (
        <div>
          <h3 className="text-base font-black text-zinc-900">キャラ設定</h3>
          <p className="mt-1 text-xs font-medium text-amber-800">本名は使わないでね</p>
        </div>
      ) : (
        <p className="text-xs font-medium text-amber-800">本名は使わないでね</p>
      )}

      <label className="block">
        <span className="text-xs font-bold text-zinc-600">社長の名前</span>
        <input
          value={value.ownerName}
          onChange={(e) =>
            onChange({ ...value, ownerName: e.target.value.slice(0, 12) })
          }
          className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none ring-[#FF9600] focus:ring-2"
          placeholder="例: カイ"
          maxLength={12}
        />
        {validateOwnerName(value.ownerName) ? (
          <p className="mt-1 text-[11px] font-medium text-rose-600">
            {validateOwnerName(value.ownerName)}
          </p>
        ) : null}
      </label>

      <div className="space-y-3">
        <p className="text-xs font-bold text-zinc-600">仲間4人</p>
        {editable.map((m) => {
          const role = m.role as (typeof EDITABLE_CAST_ROLES)[number];
          const err = validateCastName(m.name);
          return (
            <div
              key={m.id}
              className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5"
            >
              <p className="text-[10px] font-bold text-zinc-400">{ROLE_LABEL[role]}</p>
              <input
                value={m.name}
                onChange={(e) => patchMember(m.role, { name: e.target.value.slice(0, 12) })}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-sm font-semibold outline-none ring-[#FF9600] focus:ring-2"
                maxLength={12}
              />
              {err ? (
                <p className="mt-1 text-[11px] font-medium text-rose-600">{err}</p>
              ) : null}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-bold text-zinc-400">髪型</span>
                  <select
                    value={m.look.hair}
                    onChange={(e) =>
                      patchMember(m.role, {
                        look: { ...m.look, hair: Number(e.target.value) },
                      })
                    }
                    className="mt-0.5 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-semibold"
                  >
                    {HAIR_OPTS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-zinc-400">服の色</span>
                  <select
                    value={m.look.color % 4}
                    onChange={(e) =>
                      patchMember(m.role, {
                        look: { ...m.look, color: Number(e.target.value) },
                      })
                    }
                    className="mt-0.5 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-semibold"
                  >
                    {COLOR_OPTS.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function castSetupValid(value: CastSetupValue): boolean {
  if (validateOwnerName(value.ownerName)) return false;
  for (const m of value.members) {
    if (!(EDITABLE_CAST_ROLES as readonly string[]).includes(m.role)) continue;
    if (validateCastName(m.name)) return false;
  }
  return true;
}
