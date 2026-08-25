"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, RoundedBox, Html } from "@react-three/drei";
import { useDrag } from "@use-gesture/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { projectHashIndex } from "@/lib/projects/projectCardVisual";
import { projectLineShortLabel } from "@/lib/projects/roadmapTemplates";
import type { ProjectRow } from "@/lib/projects/types";

type CarouselItem =
  | { kind: "project"; project: ProjectRow & { icon?: string | null } }
  | { kind: "create"; id: "__create__" };

type Props = {
  projects: ProjectRow[];
  currentUserId: string | null;
  joinedIds: Set<string>;
  onCreate: () => void;
  loading?: boolean;
};

const NAV_BTN =
  "absolute top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-md transition hover:bg-zinc-50 active:scale-95 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:h-14 sm:w-14";

const CUBE_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4"];

/** Active cube Y rotation per frame (~60fps). Production used 0.0065; slowed ~2×. */
const ACTIVE_SPIN_PER_FRAME = 0.003;

function drawCenteredGlyph(ctx: CanvasRenderingContext2D, text: string, emoji: boolean) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (emoji) {
    ctx.font = "280px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
    ctx.fillText(text, 256, 270);
  } else {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 220px system-ui, sans-serif";
    ctx.fillText(text, 256, 272);
  }
}

function makeFaceTexture(opts: {
  bg: string;
  create?: boolean;
  icon?: string;
  letter?: string;
  imageUrl?: string | null;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, 512, 512);

  const vignette = ctx.createRadialGradient(256, 220, 40, 256, 256, 320);
  vignette.addColorStop(0, "rgba(255,255,255,0.18)");
  vignette.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, 512, 512);

  if (opts.create) {
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 36;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(256, 140);
    ctx.lineTo(256, 372);
    ctx.moveTo(140, 256);
    ctx.lineTo(372, 256);
    ctx.stroke();
  } else {
    const icon = opts.icon?.trim() || "";
    if (icon) drawCenteredGlyph(ctx, icon, true);
    else if (opts.letter) drawCenteredGlyph(ctx, opts.letter, false);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  if (opts.imageUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Cover the full square face (no letterboxing / edge bleed).
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, 512, 512);
      const scale = Math.max(512 / img.width, 512 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, 512, 512);
      texture.needsUpdate = true;
    };
    img.onerror = () => {};
    img.src = opts.imageUrl;
  }

  return texture;
}

function ProjectCube({
  item,
  active,
  side,
  phase,
  onOpen,
}: {
  item: CarouselItem;
  active: boolean;
  side: number;
  phase: number;
  onOpen: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pressRef = useRef(false);
  const scaleRef = useRef(1);

  const map = useMemo(() => {
    if (item.kind === "create") return makeFaceTexture({ bg: "#27272a", create: true });
    const p = item.project;
    const imageUrl = p.thumbnail_url?.trim() || null;
    const icon = p.icon?.trim() || undefined;
    const letter = (p.name.trim().charAt(0) || "P").toUpperCase();
    const bg = CUBE_COLORS[projectHashIndex(p.id, CUBE_COLORS.length)] ?? "#52525b";
    return makeFaceTexture({ bg, icon, letter, imageUrl });
  }, [item]);

  const materials = useMemo(
    () =>
      Array.from(
        { length: 6 },
        () =>
          new THREE.MeshPhysicalMaterial({
            map,
            roughness: 0.38,
            metalness: 0.12,
            clearcoat: 0.35,
            clearcoatRoughness: 0.4,
            transparent: true,
            opacity: active ? 1 : 0.48,
            color: active ? "#ffffff" : "#c4c4c4",
          }),
      ),
    [map, active],
  );

  useEffect(
    () => () => {
      materials.forEach((m) => m.dispose());
    },
    [materials],
  );

  useEffect(
    () => () => {
      map.dispose();
    },
    [map],
  );

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const t = state.clock.elapsedTime;

    const bob =
      0.09 * Math.sin(0.55 * t + phase) +
      0.045 * Math.sin(0.91 * t + 1.7 * phase) +
      0.02 * Math.sin(1.37 * t + 0.4 * phase);
    const sway =
      0.035 * Math.sin(0.37 * t + 2.1 * phase) + 0.018 * Math.sin(0.73 * t + phase);
    const roll = 0.04 * Math.sin(0.48 * t + 1.3 * phase);

    group.position.x = THREE.MathUtils.lerp(group.position.x, 2.85 * side + (active ? sway : 0.4 * sway), 0.08);
    group.position.y = THREE.MathUtils.lerp(group.position.y, bob, 0.1);
    group.position.z = THREE.MathUtils.lerp(group.position.z, active ? 0.15 : -1.35, 0.08);

    if (active) {
      group.rotation.y += ACTIVE_SPIN_PER_FRAME;
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, -0.42, 0.06);
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, roll, 0.08);
    } else {
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, 0.45 * side, 0.08);
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, -0.28, 0.06);
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, 0, 0.08);
    }

    const pressTarget = pressRef.current ? 0.9 : 1;
    scaleRef.current += (pressTarget - scaleRef.current) * 0.22;
    const targetScale = (active ? 1 : 0.68) * scaleRef.current;
    group.scale.setScalar(THREE.MathUtils.lerp(group.scale.x, targetScale, 0.15));
  });

  return (
    <group ref={groupRef} position={[2.85 * side, 0, active ? 0.15 : -1.35]}>
      <RoundedBox
        args={[1.9, 1.9, 1.9]}
        radius={0.14}
        smoothness={4}
        castShadow
        receiveShadow
        material={materials}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (active) pressRef.current = true;
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (active) pressRef.current = false;
        }}
        onPointerLeave={() => {
          pressRef.current = false;
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (active) onOpen();
        }}
      />
    </group>
  );
}

function CubeScene({
  items,
  safeIndex,
  onOpenIndex,
}: {
  items: CarouselItem[];
  safeIndex: number;
  onOpenIndex: (index: number) => void;
}) {
  const visible = useMemo(() => {
    const n = items.length;
    if (n === 0) return [];
    const out: Array<{ item: CarouselItem; index: number; side: number }> = [];
    for (let i = 0; i < n; i += 1) {
      let side = i - safeIndex;
      if (side > n / 2) side -= n;
      if (side < -n / 2) side += n;
      if (Math.abs(side) > 1) continue;
      out.push({ item: items[i]!, index: i, side: side === 0 ? 0 : side < 0 ? -1 : 1 });
    }
    return out;
  }, [items, safeIndex]);

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} />
      <Environment preset="city" environmentIntensity={0.45} />
      {visible.map(({ item, index, side }) => (
        <ProjectCube
          key={item.kind === "project" ? item.project.id : item.id}
          item={item}
          active={side === 0}
          side={side}
          phase={1.7 * index}
          onOpen={() => onOpenIndex(index)}
        />
      ))}
      <ContactShadows position={[0, -1.35, 0]} opacity={0.5} scale={14} blur={2.6} far={4} resolution={512} color="#1a1a1a" />
    </>
  );
}

function LoadingLabel() {
  return (
    <Html center>
      <div className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow">読み込み中…</div>
    </Html>
  );
}

export function ProjectCubeCarousel({
  projects,
  currentUserId,
  joinedIds,
  onCreate,
  loading = false,
}: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const openingRef = useRef(false);

  const items = useMemo<CarouselItem[]>(
    () => [...projects.map((p) => ({ kind: "project" as const, project: p })), { kind: "create", id: "__create__" }],
    [projects],
  );

  const count = items.length;
  const safeIndex = count === 0 ? 0 : ((index % count) + count) % count;
  const current = items[safeIndex] ?? null;
  const currentProject = current?.kind === "project" ? current.project : null;

  const goPrev = () => setIndex((i) => (count === 0 ? i : (i - 1 + count) % count));
  const goNext = () => setIndex((i) => (count === 0 ? i : (i + 1) % count));

  const bind = useDrag(
    ({ swipe: [swipeX], direction: [dirX], distance: [dx], last, cancel }) => {
      if (!last) return;
      if (Math.abs(swipeX) > 0) {
        if (swipeX < 0) goNext();
        else goPrev();
        cancel?.();
        return;
      }
      if (dx > 48) {
        if (dirX < 0) goNext();
        else goPrev();
      }
    },
    { axis: "x", filterTaps: true, threshold: 12 },
  );

  const openAt = (i: number) => {
    if (openingRef.current) return;
    const item = items[i];
    if (!item) return;
    openingRef.current = true;
    window.setTimeout(() => {
      if (item.kind === "project") router.push(`/projects/${item.project.id}/roadmap`);
      else onCreate();
      openingRef.current = false;
    }, 80);
  };

  if (loading && projects.length === 0) {
    return (
      <div className="relative h-full min-h-0 w-full flex-1" aria-busy>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_40%,#f4f4f5_0%,#ffffff_70%)]">
          <div className="h-[min(48vmin,420px)] w-[min(48vmin,420px)] animate-pulse rounded-3xl bg-zinc-200/70" />
          <p className="mt-4 text-xs text-zinc-400">読み込み中…</p>
        </div>
      </div>
    );
  }

  if (count === 0) return null;

  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
      <div
        className="absolute inset-0 touch-none overflow-hidden bg-[radial-gradient(ellipse_at_50%_38%,#f1f5f9_0%,#ffffff_62%,#fafafa_100%)]"
        {...bind()}
        style={{ touchAction: "none" }}
      >
        <Canvas
          className="!absolute inset-0 h-full w-full"
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 0.4, 4.15], fov: 42, near: 0.1, far: 40 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={<LoadingLabel />}>
            <CubeScene items={items} safeIndex={safeIndex} onOpenIndex={openAt} />
          </Suspense>
        </Canvas>

        <button type="button" className={`${NAV_BTN} left-2 sm:left-5`} aria-label="前のプロジェクト" onClick={goPrev}>
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <button type="button" className={`${NAV_BTN} right-2 sm:right-5`} aria-label="次のプロジェクト" onClick={goNext}>
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-white via-white/90 to-transparent px-4 pb-3 pt-16 text-center">
          <p className="text-2xl font-bold tracking-tight text-zinc-900 drop-shadow-sm sm:text-3xl">
            {currentProject ? currentProject.name : "新規プロジェクト"}
          </p>
          <p className="mt-1 text-[12px] text-zinc-500 sm:text-sm">
            {currentProject
              ? `${projectLineShortLabel(currentProject.business_type ?? "software")} · ${
                  currentProject.visibility === "public" ? "公開" : "非公開"
                }${currentUserId && currentProject.owner_id === currentUserId ? " · オーナー" : ""}${
                  joinedIds.has(currentProject.id) ? " · メンバー" : ""
                }`
              : "作って仲間を集める"}
          </p>
          <div className="pointer-events-auto mt-3 flex justify-center gap-1.5">
            {items.map((item, i) => (
              <button
                key={`${item.kind}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`スライド ${i + 1}`}
                className={`h-1.5 rounded-full transition ${i === safeIndex ? "w-4 bg-zinc-900" : "w-1.5 bg-zinc-300"}`}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">スワイプまたは矢印で切り替え</p>
        </div>
      </div>
    </div>
  );
}
