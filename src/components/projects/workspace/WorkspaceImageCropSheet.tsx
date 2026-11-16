"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { BoardImageCrop } from "@/lib/workspace/issueWorkspaceBoard";

type Props = {
  open: boolean;
  sourceUrl: string;
  initialCrop?: BoardImageCrop;
  onCancel: () => void;
  onConfirm: (crop: BoardImageCrop) => void;
};

/**
 * 作業スペース写真の切り取り。下からスライドするシート。
 * crop は 0–1 正規化矩形。
 */
export function WorkspaceImageCropSheet({ open, sourceUrl, initialCrop, onCancel, onConfirm }: Props) {
  const { tx } = useI18n();
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [entered, setEntered] = useState(false);
  const [frame, setFrame] = useState({ w: 280, h: 280 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNatural(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = sourceUrl;
  }, [open, sourceUrl]);

  useEffect(() => {
    if (!open) return;
    const el = frameRef.current;
    if (!el) return;
    const sync = () => setFrame({ w: el.clientWidth || 280, h: el.clientHeight || 280 });
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, natural]);

  const coverBase = useCallback(
    (fw: number, fh: number) => {
      if (!natural) return 1;
      return Math.max(fw / natural.w, fh / natural.h);
    },
    [natural],
  );

  const clampOffset = useCallback(
    (x: number, y: number, z: number) => {
      if (!natural) return { x, y };
      const base = coverBase(frame.w, frame.h);
      const dispW = natural.w * base * z;
      const dispH = natural.h * base * z;
      const maxX = Math.max(0, (dispW - frame.w) / 2);
      const maxY = Math.max(0, (dispH - frame.h) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [coverBase, frame.h, frame.w, natural],
  );

  useEffect(() => {
    if (!natural || !initialCrop) return;
    // 初期 crop をざっくりオフセットへ反映（簡易）
    const cx = (initialCrop.x + initialCrop.w / 2 - 0.5) * frame.w;
    const cy = (initialCrop.y + initialCrop.h / 2 - 0.5) * frame.h;
    setOffset(clampOffset(-cx, -cy, zoom));
  }, [clampOffset, frame.h, frame.w, initialCrop, natural, zoom]);

  if (!open) return null;

  function confirm() {
    if (!natural) return;
    const base = coverBase(frame.w, frame.h);
    const dispW = natural.w * base * zoom;
    const dispH = natural.h * base * zoom;
    const imgLeft = (frame.w - dispW) / 2 + offset.x;
    const imgTop = (frame.h - dispH) / 2 + offset.y;
    const sx = Math.min(1, Math.max(0, (0 - imgLeft) / dispW));
    const sy = Math.min(1, Math.max(0, (0 - imgTop) / dispH));
    const sw = Math.min(1 - sx, Math.max(0.05, frame.w / dispW));
    const sh = Math.min(1 - sy, Math.max(0.05, frame.h / dispH));
    onConfirm({ x: sx, y: sy, w: sw, h: sh });
  }

  return (
    <div className="fixed inset-0 z-[700] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={tx("閉じる", "Close")}
        onClick={onCancel}
      />
      <div
        className={`relative z-10 max-h-[min(88dvh,640px)] w-full rounded-t-3xl bg-white shadow-xl transition-transform duration-300 ease-out ${
          entered ? "translate-y-0" : "translate-y-full"
        }`}
        role="dialog"
        aria-modal
        aria-label={tx("写真を切り取る", "Crop photo")}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-300" aria-hidden />
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <button type="button" className="text-sm font-semibold text-zinc-600" onClick={onCancel}>
            {tx("キャンセル", "Cancel")}
          </button>
          <p className="text-sm font-bold text-zinc-900">{tx("切り取り", "Crop")}</p>
          <button type="button" className="text-sm font-bold text-[#1a73e8]" onClick={confirm} disabled={!natural}>
            {tx("完了", "Done")}
          </button>
        </div>
        <div className="px-4 pb-2">
          <div
            ref={frameRef}
            className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-zinc-900 touch-none"
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d) return;
              setOffset(clampOffset(d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y), zoom));
            }}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            {natural ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sourceUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: natural.w * coverBase(frame.w, frame.h) * zoom,
                  height: natural.h * coverBase(frame.w, frame.h) * zoom,
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-zinc-400">
                {tx("読み込み中…", "Loading…")}
              </p>
            )}
            <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/80" />
          </div>
          <label className="mt-3 flex items-center gap-3 text-[12px] font-semibold text-zinc-600">
            {tx("拡大", "Zoom")}
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => {
                const z = Number(e.target.value);
                setZoom(z);
                setOffset((o) => clampOffset(o.x, o.y, z));
              }}
              className="min-w-0 flex-1"
            />
          </label>
        </div>
        <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))]" />
      </div>
    </div>
  );
}
