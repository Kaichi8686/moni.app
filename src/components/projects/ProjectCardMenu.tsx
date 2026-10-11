"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export type ProjectCardMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  items: ProjectCardMenuItem[];
  /** メニューを上方向に開きやすくする（画面下端のカード向け） */
  preferUp?: boolean;
  label?: string;
};

type MenuCoords = { top: number; left: number };

/**
 * 三点リーダーメニュー。fixed 配置で画面端でも切れない。
 */
export function ProjectCardMenu({ items, preferUp = false, label = "メニュー" }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function openMenu() {
    const btn = rootRef.current?.getBoundingClientRect();
    if (!btn) {
      setOpen(true);
      return;
    }
    const menuW = 184;
    const menuH = Math.min(items.length * 44 + 8, 220);
    const pad = 12;
    const placeUp = preferUp || (window.innerHeight - btn.bottom - pad < menuH && btn.top - pad > menuH);
    const top = placeUp ? Math.max(pad, btn.top - menuH - 6) : Math.min(window.innerHeight - menuH - pad, btn.bottom + 6);
    let left = btn.right - menuW;
    if (left < pad) left = pad;
    if (left + menuW > window.innerWidth - pad) left = window.innerWidth - menuW - pad;
    setCoords({ top, left });
    setOpen(true);
  }

  if (items.length === 0) return null;

  const menu =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            className="fixed z-[80] min-w-[11.5rem] overflow-hidden rounded-xl border border-zinc-200/90 bg-white py-1 shadow-[var(--shadow-lg)]"
            style={{ top: coords.top, left: coords.left }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`flex w-full touch-manipulation items-center px-3.5 py-2.5 text-left text-sm font-medium transition disabled:opacity-40 ${
                  item.danger ? "text-rose-600 hover:bg-rose-50" : "text-zinc-800 hover:bg-zinc-50"
                }`}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative z-30">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) setOpen(false);
          else openMenu();
        }}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
      </button>
      {menu}
    </div>
  );
}
