"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Html, RoundedBox } from "@react-three/drei";
import { useDrag } from "@use-gesture/react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as THREE from "three";
import { projectLineShortLabel } from "@/lib/projects/roadmapTemplates";
import type { ProjectRow } from "@/lib/projects/types";
import { projectHashIndex } from "@/lib/projects/projectCardVisual";

type Props = {
  projects: ProjectRow[];
  currentUserId: string | null;
  joinedIds: Set<string>;
  onCreate: () => void;
  loading?: boolean;
};

type CubeItem = { kind: "project"; project: ProjectRow } | { kind: "create"; id: "__create__" };

const NAV_BTN =
  "absolute top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-md transition hover:bg-zinc-50 active:scale-95 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:h-14 sm:w-14";

const FACE_HEX = ["#f8fafc", "#f1f5f9", "#fafafa", "#f4f4f5", "#f8fafc", "#f5f5f4"] as const;

function hexForProject(id: string) {
  return FACE_HEX[projectHashIndex(id, FACE_HEX.length)] ?? "#f8fafc";
}

function paintFaceBase(ctx: CanvasRenderingContext2D, bg: string) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);
  const g = ctx.createRadialGradient(256, 220, 60, 256, 256, 340);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(0.55, "rgba(255,255,255,0.08)");
  g.addColorStop(1, "rgba(15,23,42,0.08)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  return g;
}

function paintEmojiOrLetter(ctx: CanvasRenderingContext2D, label: string, isEmoji: boolean) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (isEmoji) {
    ctx.font = "280px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
    ctx.fillText(label, 256, 270);
  } else {
    ctx.fillStyle = "#18181b";
    ctx.font = "bold 220px system-ui, sans-serif";
    ctx.fillText(label, 256, 272);
  }
}

function makeFaceTexture(opts: {
  bg: string;
  icon?: string | null;
  letter?: string;
  imageUrl?: string | null;
  create?: boolean;
}): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const vignette = paintFaceBase(ctx, opts.bg);

  if (opts.create) {
    ctx.strokeStyle = "rgba(24,24,27,0.88)";
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
    if (icon) paintEmojiOrLetter(ctx, icon, true);
    else if (opts.letter) paintEmojiOrLetter(ctx, opts.letter, false);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  if (opts.imageUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, 512, 512);
      const scale = Math.max(512 / img.width, 512 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, 512, 512);
      tex.needsUpdate = true;
    };
    img.onerror = () => {
      /* keep emoji / letter fallback */
    };
    img.src = opts.imageUrl;
  }

  return tex;
}

function projectFaceIcon(p: ProjectRow): { icon?: string; letter?: string; imageUrl: string | null } {
  const imageUrl = p.thumbnail_url?.trim() || null;
  const icon = p.icon?.trim() || "";
  const letter = (p.name.trim().charAt(0) || "P").toUpperCase();
  return { icon: icon || undefined, letter, imageUrl };
}

function useItemTexture(item: CubeItem) {
  return useMemo(() => {
    if (item.kind === "create") {
      return makeFaceTexture({ bg: "#fafafa", create: true });
    }
    const face = projectFaceIcon(item.project);
    return makeFaceTexture({
      bg: hexForProject(item.project.id),
      icon: face.icon,
      letter: face.letter,
      imageUrl: face.imageUrl,
    });
  }, [item]);
}

function useFaceMaterials(tex: THREE.CanvasTexture) {
  const mats = useMemo(() => {
    return Array.from({ length: 6 }, () => {
      return new THREE.MeshPhysicalMaterial({
        map: tex,
        roughness: 0.38,
        metalness: 0.12,
        clearcoat: 0.35,
        clearcoatRoughness: 0.4,
        transparent: true,
        opacity: 1,
      });
    });
  }, [tex]);

  useEffect(
    () => () => {
      mats.forEach((m) => m.dispose());
    },
    [mats],
  );

  return mats;
}

function ProjectCubeMesh({
  item,
  active,
  side,
  phase,
  onOpen,
}: {
  item: CubeItem;
  active: boolean;
  side: -1 | 0 | 1;
  phase: number;
  onOpen: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const tex = useItemTexture(item);
  const materials = useFaceMaterials(tex);
  const tapScale = useRef(1);
  const pressed = useRef(false);

  useEffect(() => () => tex.dispose(), [tex]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;

    const y =
      Math.sin(t * 0.55 + phase) * 0.09 +
      Math.sin(t * 0.91 + phase * 1.7) * 0.045 +
      Math.sin(t * 1.37 + phase * 0.4) * 0.02;
    const xWobble = Math.sin(t * 0.37 + phase * 2.1) * 0.035 + Math.sin(t * 0.73 + phase) * 0.018;
    const zRot = Math.sin(t * 0.48 + phase * 1.3) * 0.04;

    const targetX = side * 2.55;
    const targetZ = active ? 0 : -1.25;
    const targetScale = active ? 1 : 0.7;

    g.position.x = THREE.MathUtils.lerp(g.position.x, targetX + (active ? xWobble : xWobble * 0.4), 0.08);
    g.position.y = THREE.MathUtils.lerp(g.position.y, y, 0.1);
    g.position.z = THREE.MathUtils.lerp(g.position.z, targetZ, 0.08);

    if (active) {
      g.rotation.y += 0.0065;
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.42, 0.06);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, zRot, 0.08);
    } else {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, side * 0.45, 0.08);
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.28, 0.06);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 0, 0.08);
    }

    const goal = pressed.current ? 0.9 : 1;
    tapScale.current += (goal - tapScale.current) * 0.22;
    const s = targetScale * tapScale.current;
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, s, 0.15));

    const targetOpacity = active ? 1 : 0.48;
    const targetColor = active ? "#ffffff" : "#c4c4c4";
    for (const mat of materials) {
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1);
      mat.color.lerp(new THREE.Color(targetColor), 0.08);
    }
  });

  function handlePointerDown(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    if (!active) return;
    pressed.current = true;
  }

  function handlePointerUp(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    if (!active) return;
    pressed.current = false;
  }

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    if (!active) return;
    onOpen();
  }

  return (
    <group ref={group} position={[side * 2.55, 0, active ? 0 : -1.25]}>
      <RoundedBox
        ref={mesh}
        args={[1.65, 1.65, 1.65]}
        radius={0.12}
        smoothness={4}
        castShadow
        receiveShadow
        material={materials}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          pressed.current = false;
        }}
        onClick={handleClick}
      />
    </group>
  );
}

function SceneCubes({
  items,
  safeIndex,
  onOpenIndex,
}: {
  items: CubeItem[];
  safeIndex: number;
  onOpenIndex: (index: number) => void;
}) {
  const visible = useMemo(() => {
    const count = items.length;
    if (count === 0) return [] as { item: CubeItem; index: number; side: -1 | 0 | 1 }[];
    const out: { item: CubeItem; index: number; side: -1 | 0 | 1 }[] = [];
    for (let i = 0; i < count; i += 1) {
      let raw = i - safeIndex;
      if (raw > count / 2) raw -= count;
      if (raw < -count / 2) raw += count;
      if (Math.abs(raw) > 1) continue;
      out.push({ item: items[i]!, index: i, side: raw === 0 ? 0 : raw < 0 ? -1 : 1 });
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
        <ProjectCubeMesh
          key={item.kind === "project" ? item.project.id : item.id}
          item={item}
          active={side === 0}
          side={side}
          phase={index * 1.7}
          onOpen={() => onOpenIndex(index)}
        />
      ))}

      <ContactShadows
        position={[0, -1.2, 0]}
        opacity={0.42}
        scale={12}
        blur={2.5}
        far={3.8}
        resolution={512}
        color="#1a1a1a"
      />
    </>
  );
}

function SceneFallback() {
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
  const [activeIndex, setActiveIndex] = useState(0);
  const pressLockRef = useRef(false);

  const items = useMemo<CubeItem[]>(
    () => [...projects.map((project) => ({ kind: "project" as const, project })), { kind: "create", id: "__create__" }],
    [projects],
  );
  const count = items.length;
  const safeIndex = count === 0 ? 0 : ((activeIndex % count) + count) % count;
  const activeItem = items[safeIndex] ?? null;
  const meta = activeItem?.kind === "project" ? activeItem.project : null;

  const prev = () => setActiveIndex((i) => (count === 0 ? i : (i - 1 + count) % count));
  const next = () => setActiveIndex((i) => (count === 0 ? i : (i + 1) % count));

  function openIndex(index: number) {
    if (pressLockRef.current) return;
    const item = items[index];
    if (!item) return;
    pressLockRef.current = true;
    window.setTimeout(() => {
      if (item.kind === "project") router.push(`/projects/${item.project.id}/roadmap`);
      else onCreate();
      pressLockRef.current = false;
    }, 80);
  }

  const bind = useDrag(
    ({ swipe: [swipeX], direction: [dx], distance: [distX], last, cancel }) => {
      if (!last) return;
      if (Math.abs(swipeX) > 0) {
        if (swipeX < 0) next();
        else prev();
        cancel?.();
        return;
      }
      if (distX > 48) {
        if (dx < 0) next();
        else prev();
      }
    },
    { axis: "x", filterTaps: true, threshold: 12 },
  );

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
          camera={{ position: [0, 0.35, 5.35], fov: 38, near: 0.1, far: 40 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={<SceneFallback />}>
            <SceneCubes items={items} safeIndex={safeIndex} onOpenIndex={openIndex} />
          </Suspense>
        </Canvas>

        <button type="button" className={`${NAV_BTN} left-2 sm:left-5`} aria-label="前のプロジェクト" onClick={prev}>
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
        <button type="button" className={`${NAV_BTN} right-2 sm:right-5`} aria-label="次のプロジェクト" onClick={next}>
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-white via-white/90 to-transparent px-4 pb-3 pt-16 text-center">
          <p className="text-2xl font-bold tracking-tight text-zinc-900 drop-shadow-sm sm:text-3xl">
            {meta ? meta.name : "新規プロジェクト"}
          </p>
          <p className="mt-1 text-[12px] text-zinc-500 sm:text-sm">
            {meta
              ? `${projectLineShortLabel(meta.business_type ?? "software")} · ${meta.visibility === "public" ? "公開" : "非公開"}${currentUserId && meta.owner_id === currentUserId ? " · オーナー" : ""}${joinedIds.has(meta.id) ? " · メンバー" : ""}`
              : "作って仲間を集める"}
          </p>
          <div className="pointer-events-auto mt-3 flex justify-center gap-1.5">
            {items.map((item, idx) => (
              <button
                key={`${item.kind}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`スライド ${idx + 1}`}
                className={`h-1.5 rounded-full transition ${idx === safeIndex ? "w-4 bg-zinc-900" : "w-1.5 bg-zinc-300"}`}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">スワイプまたは矢印で切り替え</p>
        </div>
      </div>
    </div>
  );
}
