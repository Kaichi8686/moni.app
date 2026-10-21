"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html, RoundedBox } from "@react-three/drei";
import { useDrag } from "@use-gesture/react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as THREE from "three";
import { openProjectCluster } from "@/lib/navigation/projectCluster";
import { projectLineShortLabel } from "@/lib/projects/roadmapTemplates";
import type { ProjectRow } from "@/lib/projects/types";
import { projectHashIndex } from "@/lib/projects/projectCardVisual";
import { rememberLastProject } from "@/lib/workspace/lastProject";

/** Active cube Y rotation per frame (~60fps). Kept slow so faces stay readable. */
const ACTIVE_SPIN_PER_FRAME = 0.003;
/** 256 keeps faces sharp enough while cutting GPU/CPU texture cost in half. */
const FACE_TEX_SIZE = 256;
/** Soft rounded cube — matches the floating carousel look. */
const CUBE_SIZE = 1.9;
const CUBE_RADIUS = 0.22;
const CUBE_SMOOTHNESS = 3;
const CUBE_SPACING = 2.85;
const INACTIVE_TINT = new THREE.Color("#c4c4c4");
const ACTIVE_TINT = new THREE.Color("#ffffff");

type Props = {
  projects: ProjectRow[];
  currentUserId: string | null;
  joinedIds: Set<string>;
  onCreate: () => void;
  loading?: boolean;
};

type CubeItem = { kind: "project"; project: ProjectRow } | { kind: "create"; id: "__create__" };

type FacePaintOpts = {
  bg: string;
  create?: boolean;
  icon?: string;
  letter?: string;
  imageUrl?: string | null;
};

const NAV_BTN =
  "absolute top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-md transition hover:bg-zinc-50 active:scale-95 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 sm:h-14 sm:w-14";

const FACE_HEX = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4"] as const;

function hexForProject(id: string) {
  return FACE_HEX[projectHashIndex(id, FACE_HEX.length)] ?? "#52525b";
}

function paintEmojiOrLetter(ctx: CanvasRenderingContext2D, label: string, isEmoji: boolean) {
  const mid = FACE_TEX_SIZE / 2;
  const scale = FACE_TEX_SIZE / 512;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (isEmoji) {
    ctx.font = `${Math.round(280 * scale)}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
    ctx.fillText(label, mid, mid + 7 * scale);
  } else {
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(220 * scale)}px system-ui, sans-serif`;
    ctx.fillText(label, mid, mid + 8 * scale);
  }
}

function paintFaceFallback(ctx: CanvasRenderingContext2D, opts: FacePaintOpts & { photoPending?: boolean }) {
  const s = FACE_TEX_SIZE;
  const mid = s / 2;
  const scale = s / 512;
  ctx.fillStyle = opts.photoPending ? "#18181b" : opts.bg;
  ctx.fillRect(0, 0, s, s);
  if (opts.photoPending) return;

  const vignette = ctx.createRadialGradient(mid, 220 * scale, 40 * scale, mid, mid, 320 * scale);
  vignette.addColorStop(0, "rgba(255,255,255,0.18)");
  vignette.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, s, s);

  if (opts.create) {
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 36 * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mid, 140 * scale);
    ctx.lineTo(mid, 372 * scale);
    ctx.moveTo(140 * scale, mid);
    ctx.lineTo(372 * scale, mid);
    ctx.stroke();
    return;
  }

  const icon = opts.icon?.trim() || "";
  if (icon) paintEmojiOrLetter(ctx, icon, true);
  else if (opts.letter) paintEmojiOrLetter(ctx, opts.letter, false);
}

/** object-fit: cover — fill the square face edge-to-edge with no letterbox / edge streak. */
function paintFacePhotoCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (w <= 0 || h <= 0) return false;

  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, 0, FACE_TEX_SIZE, FACE_TEX_SIZE);
  const scale = Math.max(FACE_TEX_SIZE / w, FACE_TEX_SIZE / h);
  const drawW = w * scale;
  const drawH = h * scale;
  ctx.drawImage(img, (FACE_TEX_SIZE - drawW) / 2, (FACE_TEX_SIZE - drawH) / 2, drawW, drawH);
  return true;
}

function createFaceTextureCanvas(opts: FacePaintOpts) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_TEX_SIZE;
  canvas.height = FACE_TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    paintFaceFallback(ctx, { ...opts, photoPending: Boolean(opts.imageUrl?.trim()) });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function faceOptsForItem(item: CubeItem): FacePaintOpts {
  if (item.kind === "create") {
    return { bg: "#27272a", create: true };
  }
  const p = item.project;
  return {
    bg: hexForProject(p.id),
    icon: p.icon?.trim() || undefined,
    letter: (p.name.trim().charAt(0) || "P").toUpperCase(),
    imageUrl: p.thumbnail_url?.trim() || null,
  };
}

function useFaceTexture(item: CubeItem) {
  const invalidate = useThree((state) => state.invalidate);
  const opts = useMemo(() => faceOptsForItem(item), [item]);
  const imageUrl = opts.imageUrl?.trim() || null;
  const texture = useMemo(
    () => createFaceTextureCanvas({ ...opts, imageUrl }),
    // One texture per cube mount; carousel items are keyed by project id.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable per instance
    [],
  );

  useEffect(() => {
    const canvas = texture.image;
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const markDirty = () => {
      texture.needsUpdate = true;
      invalidate();
    };

    if (!imageUrl) {
      paintFaceFallback(ctx, opts);
      markDirty();
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      if (!paintFacePhotoCover(ctx, img)) {
        paintFaceFallback(ctx, opts);
      }
      markDirty();
    };
    img.onerror = () => {
      if (cancelled) return;
      paintFaceFallback(ctx, opts);
      markDirty();
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };
  }, [texture, imageUrl, invalidate, opts]);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  return texture;
}

function itemHasPhoto(item: CubeItem) {
  return item.kind === "project" && Boolean(item.project.thumbnail_url?.trim());
}

/**
 * RoundedBox default UVs smear photos across fillets.
 * Remap to planar 0–1 projections per face so cover textures fit like a flat square,
 * while keeping the soft rounded silhouette.
 */
function remapRoundedBoxPlanarUVs(geometry: THREE.BufferGeometry, size: number) {
  const pos = geometry.getAttribute("position");
  if (!pos) return;

  let uvAttr = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uvAttr || uvAttr.count !== pos.count) {
    uvAttr = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    geometry.setAttribute("uv", uvAttr);
  }

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const az = Math.abs(z);

    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) {
      // ±X faces
      u = 0.5 + (x >= 0 ? -z : z) / size;
      v = 0.5 + y / size;
    } else if (ay >= ax && ay >= az) {
      // ±Y faces
      u = 0.5 + x / size;
      v = 0.5 + (y >= 0 ? z : -z) / size;
    } else {
      // ±Z faces
      u = 0.5 + (z >= 0 ? x : -x) / size;
      v = 0.5 + y / size;
    }
    uvAttr.setXY(i, THREE.MathUtils.clamp(u, 0, 1), THREE.MathUtils.clamp(v, 0, 1));
  }
  uvAttr.needsUpdate = true;
  geometry.userData.planarUVs = true;
}

function createFaceMaterials(tex: THREE.CanvasTexture, hasPhoto: boolean) {
  // MeshStandardMaterial is cheaper than Physical+clearcoat and looks close enough here.
  return Array.from({ length: 6 }, () =>
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: hasPhoto ? 0.52 : 0.42,
      metalness: hasPhoto ? 0 : 0.08,
      color: "#ffffff",
      transparent: true,
      opacity: 1,
    }),
  );
}

function useFaceMaterials(tex: THREE.CanvasTexture, hasPhoto: boolean) {
  const materials = useMemo(() => createFaceMaterials(tex, hasPhoto), [tex, hasPhoto]);

  useEffect(
    () => () => {
      for (const m of materials) m.dispose();
    },
    [materials],
  );

  return materials;
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
  const meshRef = useRef<THREE.Mesh>(null);
  const tex = useFaceTexture(item);
  const hasPhoto = itemHasPhoto(item);
  const materials = useFaceMaterials(tex, hasPhoto);
  const tapScale = useRef(1);
  const pressed = useRef(false);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh?.geometry) return;
    if (mesh.geometry.userData.planarUVs) return;
    // Clone so we never mutate a geometry instance shared across cubes.
    const geo = mesh.geometry.clone();
    remapRoundedBoxPlanarUVs(geo, CUBE_SIZE);
    mesh.geometry = geo;
    return () => {
      geo.dispose();
    };
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;

    const bob =
      0.09 * Math.sin(0.55 * t + phase) +
      0.045 * Math.sin(0.91 * t + 1.7 * phase) +
      0.02 * Math.sin(1.37 * t + 0.4 * phase);
    const sway =
      0.035 * Math.sin(0.37 * t + 2.1 * phase) + 0.018 * Math.sin(0.73 * t + phase);
    const roll = 0.04 * Math.sin(0.48 * t + 1.3 * phase);

    g.position.x = THREE.MathUtils.lerp(
      g.position.x,
      CUBE_SPACING * side + (active ? sway : 0.4 * sway),
      0.08,
    );
    g.position.y = THREE.MathUtils.lerp(g.position.y, bob, 0.1);
    g.position.z = THREE.MathUtils.lerp(g.position.z, active ? 0.15 : -1.35, 0.08);

    if (active) {
      g.rotation.y += ACTIVE_SPIN_PER_FRAME;
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.42, 0.06);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, roll, 0.08);
    } else {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0.45 * side, 0.08);
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.28, 0.06);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 0, 0.08);
    }

    const pressTarget = pressed.current ? 0.9 : 1;
    tapScale.current += (pressTarget - tapScale.current) * 0.22;
    const targetScale = (active ? 1 : 0.68) * tapScale.current;
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, targetScale, 0.15));

    /* Three.js materials are mutated each frame for fade/tint (not React state). */
    /* eslint-disable react-hooks/immutability -- R3F mesh materials */
    if (!hasPhoto) {
      const targetOpacity = active ? 1 : 0.48;
      const targetColor = active ? ACTIVE_TINT : INACTIVE_TINT;
      for (const mat of materials) {
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, 0.1);
        mat.color.lerp(targetColor, 0.08);
      }
    } else {
      for (const mat of materials) {
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, active ? 1 : 0.55, 0.1);
      }
    }
    /* eslint-enable react-hooks/immutability */
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
    <group ref={group} position={[CUBE_SPACING * side, 0, active ? 0.15 : -1.35]}>
      <RoundedBox
        ref={meshRef}
        args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]}
        radius={CUBE_RADIUS}
        smoothness={CUBE_SMOOTHNESS}
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
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 3]} intensity={1.05} castShadow shadow-mapSize={[512, 512]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} />

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
        position={[0, -1.35, 0]}
        opacity={0.32}
        scale={14}
        blur={2.2}
        far={4.2}
        resolution={256}
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
  const [tabVisible, setTabVisible] = useState(true);
  const pressLockRef = useRef(false);

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

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
      if (item.kind === "project") {
        rememberLastProject(item.project.id, item.project.name);
        openProjectCluster();
        router.push(`/projects/${item.project.id}/overview`);
      } else {
        onCreate();
      }
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

  // Keep the create cube visible while membership loads — avoid a long blank pulse.
  if (count === 0) {
    if (!loading) return null;
    return (
      <div className="relative h-full min-h-0 w-full flex-1" aria-busy>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_40%,#f4f4f5_0%,#ffffff_70%)]">
          <div className="h-[min(48vmin,420px)] w-[min(48vmin,420px)] animate-pulse rounded-3xl bg-zinc-200/70" />
          <p className="mt-4 text-xs text-zinc-400">読み込み中…</p>
        </div>
      </div>
    );
  }

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
          dpr={[1, 1.25]}
          frameloop={tabVisible ? "always" : "never"}
          camera={{ position: [0, 0.35, 5.35], fov: 38, near: 0.1, far: 40 }}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
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
