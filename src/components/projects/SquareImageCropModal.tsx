"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  sourceUrl: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void | Promise<void>;
};

const OUT_SIZE = 1024;

function coverBase(frame: number, natW: number, natH: number) {
  return Math.max(frame / natW, frame / natH);
}

/**
 * Square crop editor for cube thumbnails: pan + zoom a rectangular photo into 1:1.
 */
export function SquareImageCropModal({ sourceUrl, open, onCancel, onConfirm }: Props) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [frameSize, setFrameSize] = useState(280);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setErr("");
    setNatural(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setErr("画像を読み込めませんでした。別のファイルを試してください。");
    img.src = sourceUrl;
  }, [open, sourceUrl]);

  useEffect(() => {
    if (!open) return;
    const el = frameRef.current;
    if (!el) return;
    const sync = () => setFrameSize(el.clientWidth || 280);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, natural]);

  const clampOffset = useCallback(
    (x: number, y: number, z: number, frame: number) => {
      if (!natural) return { x, y };
      const base = coverBase(frame, natural.w, natural.h);
      const dispW = natural.w * base * z;
      const dispH = natural.h * base * z;
      const maxX = Math.max(0, (dispW - frame) / 2);
      const maxY = Math.max(0, (dispH - frame) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [natural],
  );

  useEffect(() => {
    setOffset((o) => clampOffset(o.x, o.y, zoom, frameSize));
  }, [zoom, frameSize, clampOffset]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clampOffset(d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y), zoom, frameSize));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  async function confirm() {
    if (!natural) return;
    setBusy(true);
    setErr("");
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
        img.src = sourceUrl;
      });

      const frame = frameSize;
      const base = coverBase(frame, natural.w, natural.h);
      const dispW = natural.w * base * zoom;
      const dispH = natural.h * base * zoom;
      const imgLeft = (frame - dispW) / 2 + offset.x;
      const imgTop = (frame - dispH) / 2 + offset.y;
      const sx = ((0 - imgLeft) / dispW) * natural.w;
      const sy = ((0 - imgTop) / dispH) * natural.h;
      const sw = (frame / dispW) * natural.w;
      const sh = (frame / dispH) * natural.h;

      const canvas = document.createElement("canvas");
      canvas.width = OUT_SIZE;
      canvas.height = OUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("キャンバスを初期化できませんでした");
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_SIZE, OUT_SIZE);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("書き出しに失敗しました"))), "image/jpeg", 0.92);
      });
      await onConfirm(blob);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "切り抜きに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const base = natural ? coverBase(frameSize, natural.w, natural.h) : 1;
  const dispW = natural ? natural.w * base * zoom : 0;
  const dispH = natural ? natural.h * base * zoom : 0;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-4 py-3">
          <h3 className="text-base font-bold text-zinc-900">キューブ用に切り抜く</h3>
          <p className="mt-0.5 text-xs text-zinc-500">正方形に合わせて、写したい位置をドラッグで調整してください。</p>
        </div>

        <div className="px-4 pt-4">
          <div
            ref={frameRef}
            className="relative mx-auto aspect-square w-full max-w-[280px] touch-none overflow-hidden rounded-2xl bg-zinc-900 ring-2 ring-zinc-900"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {natural ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sourceUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: dispW,
                  height: dispH,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">読み込み中…</div>
            )}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/30" />
          </div>

          <label className="mt-4 flex items-center gap-3 text-xs text-zinc-600">
            <span className="shrink-0 font-semibold">拡大</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
              aria-label="拡大率"
            />
          </label>
          {err ? <p className="mt-2 text-xs text-rose-600">{err}</p> : null}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 px-4 py-3">
          <button
            type="button"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50"
            onClick={onCancel}
            disabled={busy}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void confirm()}
            disabled={busy || !natural}
          >
            {busy ? "処理中…" : "この範囲を使う"}
          </button>
        </div>
      </div>
    </div>
  );
}
