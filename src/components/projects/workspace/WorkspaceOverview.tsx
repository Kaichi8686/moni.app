"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ComponentType } from "react";
import {
  Camera,
  FileText,
  ImagePlus,
  PenLine,
  PenTool,
  Sparkles,
  Vote,
} from "lucide-react";
import { ProjectBriefSection } from "@/components/projects/workspace/ProjectBriefSection";
import { ProjectDeletionVoteBanner } from "@/components/projects/workspace/ProjectDeletionVoteBanner";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapPath, RoadmapPathItem } from "@/components/projects/workspace/roadmap/RoadmapPath";
import { RoadmapPathNode } from "@/components/projects/workspace/roadmap/RoadmapPathNode";
import { RoadmapPhaseInfoSheet } from "@/components/projects/workspace/roadmap/RoadmapPhaseInfoSheet";
import { RoadmapStepMark } from "@/components/projects/workspace/roadmap/roadmapPathMarks";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { validateProjectImageFile } from "@/lib/projects/uploadProjectImage";
import { supabase } from "@/lib/supabase";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";
import { assigneeLabel, isIssueAssignedTo } from "@/lib/workspace/issueAssignees";
import { isIssueSubmitted, isoToDateInput } from "@/lib/workspace/issueWork";
import { sortIssuesByDueDate } from "@/lib/workspace/sortIssuesByDueDate";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif";

/** 概要のロードマップカードは order 順で最大この件数まで常時表示 */
const ROADMAP_VISIBLE_LIMIT = 6;

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function ActionLink({
  href,
  icon: IconComponent,
  label,
  detail,
  filled = false,
}: {
  href: string;
  icon: Icon;
  label: string;
  detail?: string;
  filled?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[104px] flex-col justify-between rounded-2xl border p-4 transition active:scale-[0.99] ${
        filled
          ? "border-violet-600 bg-violet-600 text-white shadow-sm hover:bg-violet-700"
          : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <IconComponent className="h-6 w-6" aria-hidden />
      <div className="mt-4">
        <p className="text-[15px] font-semibold">{label}</p>
        {detail ? <p className={`mt-0.5 text-[12px] ${filled ? "text-violet-100" : "text-zinc-500"}`}>{detail}</p> : null}
      </div>
    </Link>
  );
}

function CompactLink({ href, icon: IconComponent, label }: { href: string; icon: Icon; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-2 text-center transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] sm:min-h-[104px]"
    >
      <IconComponent className="h-6 w-6 text-zinc-700 sm:h-7 sm:w-7" aria-hidden />
      <span className="text-[13px] font-semibold text-zinc-800 sm:text-sm">{label}</span>
    </Link>
  );
}

export default function WorkspaceOverview() {
  const { tx } = useI18n();
  const router = useRouter();
  const {
    project,
    projectMeta,
    projectId,
    issues,
    phases: workspacePhases,
    loading,
    uid,
    canEdit,
    reload: wsReload,
  } = useProjectWorkspace();
  const roadmap = useRoadmapProject(projectId);
  const roadmapEditHref = `/projects/${projectId}/roadmap`;
  const photoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [expandState, setExpandState] = useState<{ projectId: string; open: boolean }>({
    projectId,
    open: false,
  });
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [bgError, setBgError] = useState("");
  const roadmapExpanded = expandState.open && expandState.projectId === projectId;
  const photoUrl = (photoPreview ?? projectMeta?.thumbnail_url)?.trim() || "";
  const backgroundUrl = (bgPreview ?? projectMeta?.background_url)?.trim() || "";

  /**
   * 「すべて見る」地図ページと同じ project_phases を使う。
   * 地図側で削除した直後でも概要に戻ったときに連動するよう、
   * roadmap hook を優先し、初回ロード中のみ workspace のキャッシュを出す。
   * reload 中も roadmap.phases を保持し、達成直後に古い workspace へ戻らないようにする。
   */
  const sortedPhases = useMemo(() => {
    const source = roadmap.phases.length > 0 ? roadmap.phases : workspacePhases;
    return [...source].sort((a, b) => a.order - b.order);
  }, [roadmap.phases, workspacePhases]);
  const selectedPhaseLive = selectedPhaseId
    ? sortedPhases.find((phase) => phase.id === selectedPhaseId) ?? null
    : null;
  /** order 順のまま表示（完了を末尾に回すと「いまここ」が先頭に残り、進んだように見えない） */
  const displayPhases = sortedPhases;
  const visiblePhases = useMemo(
    () => (roadmapExpanded ? displayPhases : displayPhases.slice(0, ROADMAP_VISIBLE_LIMIT)),
    [displayPhases, roadmapExpanded],
  );
  const hiddenPhaseCount = Math.max(0, displayPhases.length - visiblePhases.length);

  const upcomingIssues = useMemo(
    () =>
      sortIssuesByDueDate(
        issues.filter(
          (issue) =>
            issue.status !== "cancelled" &&
            !isIssueSubmitted(issue) &&
            isIssueAssignedTo(issue, uid),
        ),
      ).slice(0, 3),
    [issues, uid],
  );

  async function uploadWithToken(
    endpoint: "/api/upload-project-image" | "/api/upload-project-background",
    file: File,
  ): Promise<string> {
    if (!supabase) throw new Error(tx("ログイン後に写真をアップロードできます。", "Log in to upload a photo."));
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error(tx("ログインが必要です", "Login required"));
    const body = new FormData();
    body.append("file", file);
    body.append("projectId", projectId);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    const json = (await res.json()) as { publicUrl?: string; backgroundUrl?: string; error?: string };
    if (!res.ok) throw new Error(json.error ?? tx("アップロードに失敗しました", "Upload failed"));
    return json.backgroundUrl ?? json.publicUrl ?? "";
  }

  async function handlePhotoUpload(file: File | null) {
    if (!file || !canEdit) return;
    const validationErr = validateProjectImageFile(file);
    if (validationErr) {
      setPhotoError(validationErr);
      return;
    }
    setPhotoUploading(true);
    setPhotoError("");
    try {
      const url = await uploadWithToken("/api/upload-project-image", file);
      setPhotoPreview(url || null);
      await wsReload();
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : tx("写真の変更に失敗しました", "Couldn’t change photo"));
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleBackgroundUpload(file: File | null) {
    if (!file || !canEdit) return;
    const validationErr = validateProjectImageFile(file);
    if (validationErr) {
      setBgError(validationErr);
      return;
    }
    setBgUploading(true);
    setBgError("");
    try {
      const url = await uploadWithToken("/api/upload-project-background", file);
      setBgPreview(url || null);
      await wsReload();
    } catch (e) {
      setBgError(e instanceof Error ? e.message : tx("背景の変更に失敗しました", "Couldn’t change background"));
    } finally {
      setBgUploading(false);
      if (bgInputRef.current) bgInputRef.current.value = "";
    }
  }

  // Don't block the whole overview once the project shell is available.
  if (loading && !project) {
    return <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>;
  }
  if (!project) return <p className="text-sm text-zinc-500">{tx("プロジェクトがありません。", "No project found.")}</p>;

  const completedSteps = sortedPhases.filter((phase) => phase.status === "completed").length;
  const inProgressIndex = sortedPhases.findIndex((phase) => phase.status === "in_progress");
  const firstOpenIndex = sortedPhases.findIndex((phase) => phase.status !== "completed");
  const currentIndex = Math.max(0, inProgressIndex >= 0 ? inProgressIndex : firstOpenIndex);
  const progress =
    sortedPhases.length > 0
      ? Math.round((completedSteps / sortedPhases.length) * 100)
      : issues.length > 0
        ? Math.round((issues.filter((issue) => issue.status === "done").length / issues.length) * 100)
        : 0;

  return (
    <div className="pb-8">
      {/* 背景（background_url）と正方形写真（thumbnail_url）は別画像 */}
      <section className="-mx-4 -mt-4 border-b border-zinc-200 bg-white md:-mx-6 md:-mt-5">
        <div className="relative h-44 w-full overflow-hidden bg-zinc-100 sm:h-52">
          {backgroundUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-owned Supabase image
            <img src={backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(145deg, #fed7aa 0%, #fdba74 42%, #fb923c 100%)",
              }}
              aria-hidden
            />
          )}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent"
            aria-hidden
          />
          {canEdit ? (
            <>
              <input
                ref={bgInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => void handleBackgroundUpload(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                disabled={bgUploading}
                onClick={() => bgInputRef.current?.click()}
                className="absolute bottom-3 right-3 z-10 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/30 bg-black/45 px-3 text-[12px] font-semibold text-white backdrop-blur-sm transition hover:bg-black/55 disabled:opacity-50"
                aria-label={
                  backgroundUrl ? tx("背景を変更", "Change background") : tx("背景を追加", "Add background")
                }
                title={
                  backgroundUrl ? tx("背景を変更", "Change background") : tx("背景を追加", "Add background")
                }
              >
                {backgroundUrl ? <Camera className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {bgUploading
                  ? tx("アップロード中…", "Uploading…")
                  : backgroundUrl
                    ? tx("背景を変更", "Change")
                    : tx("背景を追加", "Add")}
              </button>
            </>
          ) : null}
        </div>

        <div className="px-4 pb-5 sm:px-5 md:px-6">
          <div className="relative z-10 mx-auto max-w-3xl">
            <div className="-mt-9 flex items-end gap-4">
              <div className="relative shrink-0">
                <div className="h-16 w-16 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 sm:h-20 sm:w-20">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- user-owned Supabase image
                    <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-orange-100 text-3xl">
                      {project.icon ?? "📁"}
                    </div>
                  )}
                </div>
                {canEdit ? (
                  <>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept={IMAGE_ACCEPT}
                      className="hidden"
                      onChange={(e) => void handlePhotoUpload(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      disabled={photoUploading}
                      onClick={() => photoInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
                      aria-label={
                        photoUrl
                          ? tx("プロジェクト写真を変更", "Change project photo")
                          : tx("プロジェクト写真を追加", "Add project photo")
                      }
                      title={
                        photoUrl
                          ? tx("プロジェクト写真を変更", "Change project photo")
                          : tx("プロジェクト写真を追加", "Add project photo")
                      }
                    >
                      {photoUrl ? <Camera className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    </button>
                  </>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-0.5 pt-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl">
                      {project.name}
                    </h2>
                    <p className="mt-1 text-[12px] text-zinc-500">
                      {tx(`${project.members.length}人のメンバー`, `${project.members.length} members`)}
                    </p>
                  </div>
                  <p className="shrink-0 text-2xl font-semibold tabular-nums tracking-tight text-orange-500 sm:text-3xl">
                    {progress}%
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13px] font-medium text-zinc-700">
              {sortedPhases.length > 0
                ? tx(
                    `ステップ ${completedSteps}/${sortedPhases.length} 完了`,
                    `${completedSteps}/${sortedPhases.length} steps complete`,
                  )
                : tx("ロードマップ未設定", "Roadmap not set")}
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-orange-400 transition-[width] duration-500"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              />
            </div>
            {bgError ? <p className="mt-2 text-xs text-rose-600">{bgError}</p> : null}
            {photoError ? <p className="mt-2 text-xs text-rose-600">{photoError}</p> : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-7 pt-7">
      <ProjectBriefSection />
      <ProjectDeletionVoteBanner />
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-950 sm:text-lg">{tx("ロードマップ", "Roadmap")}</h2>
          {canEdit ? (
            <Link
              href={roadmapEditHref}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[12px] font-bold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
            >
              <PenLine className="h-3.5 w-3.5" aria-hidden />
              {tx("編集する", "Edit")}
            </Link>
          ) : null}
        </div>
        {sortedPhases.length > 0 ? (
          <>
            <RoadmapPath
              segmentCleared={visiblePhases.map((phase) => {
                const index = sortedPhases.findIndex((item) => item.id === phase.id);
                return phase.status === "completed" || index < currentIndex;
              })}
            >
              {visiblePhases.map((phase, visibleIndex) => {
                const index = sortedPhases.findIndex((item) => item.id === phase.id);
                const complete = phase.status === "completed";
                const current = phase.status === "in_progress" || (!complete && index === currentIndex);
                /** 先のマスは灰色（中身は開ける） */
                const upcoming = !complete && !current && index > currentIndex;
                const tone = complete ? "done" : upcoming ? "upcoming" : "active";
                return (
                  <RoadmapPathItem key={phase.id} index={visibleIndex}>
                    <RoadmapPathNode
                      tone={tone}
                      sparkle={current}
                      selected={selectedPhaseId === phase.id}
                      onClick={() => setSelectedPhaseId(phase.id)}
                      aria-label={tx(`ステップ ${index + 1}: ${phase.title}`, `Step ${index + 1}: ${phase.title}`)}
                    >
                      <RoadmapStepMark markId={phase.icon} index={index} tone={tone} />
                    </RoadmapPathNode>
                  </RoadmapPathItem>
                );
              })}
            </RoadmapPath>
            {hiddenPhaseCount > 0 ? (
              <button
                type="button"
                onClick={() => setExpandState({ projectId, open: true })}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              >
                {tx(`もっと見る（あと${hiddenPhaseCount}件）`, `Show more (${hiddenPhaseCount} more)`)}
              </button>
            ) : roadmapExpanded && displayPhases.length > ROADMAP_VISIBLE_LIMIT ? (
              <button
                type="button"
                onClick={() => setExpandState({ projectId, open: false })}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                {tx(`閉じる（${ROADMAP_VISIBLE_LIMIT}件まで表示）`, `Show fewer (up to ${ROADMAP_VISIBLE_LIMIT})`)}
              </button>
            ) : null}
          </>
        ) : (
          <RoadmapPath>
            <RoadmapPathItem index={0}>
              <RoadmapPathNode
                tone="create"
                sparkle
                onClick={() => router.push(`${roadmapEditHref}?add=1`)}
                aria-label={tx("ロードマップを作成する", "Create roadmap")}
              >
                <RoadmapStepMark index={0} tone="create" />
              </RoadmapPathNode>
            </RoadmapPathItem>
          </RoadmapPath>
        )}
      </section>

      <RoadmapPhaseInfoSheet
        open={Boolean(selectedPhaseLive)}
        phase={
          selectedPhaseLive
            ? {
                id: selectedPhaseLive.id,
                title: selectedPhaseLive.title,
                goal: selectedPhaseLive.goal,
                description: selectedPhaseLive.description,
                stepNumber: sortedPhases.findIndex((item) => item.id === selectedPhaseLive.id) + 1,
                alreadyDone: selectedPhaseLive.status === "completed",
              }
            : null
        }
        onClose={() => setSelectedPhaseId(null)}
        canEdit={false}
        canAchieve={Boolean(
          roadmap.canEdit &&
            selectedPhaseLive &&
            selectedPhaseLive.status !== "completed" &&
            (selectedPhaseLive.status === "in_progress" ||
              sortedPhases.findIndex((item) => item.id === selectedPhaseLive.id) === currentIndex),
        )}
        onAchieve={async () => {
          if (!selectedPhaseLive) return;
          if (!roadmap.canEdit) {
            throw new Error(tx("編集権限がありません", "You don’t have permission to edit"));
          }
          const idx = sortedPhases.findIndex((item) => item.id === selectedPhaseLive.id);
          const next = idx >= 0 ? sortedPhases[idx + 1] : undefined;
          await roadmap.updatePhase(selectedPhaseLive.id, { status: "completed" });
          if (next && next.status !== "completed") {
            await roadmap.updatePhase(next.id, { status: "in_progress" });
          }
          await wsReload();
          setSelectedPhaseId(null);
        }}
      />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-950 sm:text-lg">{tx("今やるべき課題", "What to do now")}</h2>
          <Link href={`/projects/${projectId}/issues`} className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-900">
            {tx("課題一覧", "All issues")}
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {upcomingIssues.length > 0 ? (
            <ul className="list-none divide-y divide-zinc-100">
              {upcomingIssues.map((issue) => {
                const assignees = assigneeLabel(issue, project.members, tx("未担当", "Unassigned"));
                return (
                  <li key={issue.id}>
                    <Link
                      href={`/projects/${projectId}/issues?task=${issue.id}`}
                      className="flex min-h-[58px] items-center gap-3 px-3.5 py-2.5 hover:bg-zinc-50 sm:px-4"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-zinc-800 sm:text-sm">{issue.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                          {[
                            issue.beginAt ? tx(`開始 ${isoToDateInput(issue.beginAt)}`, `Start ${isoToDateInput(issue.beginAt)}`) : "",
                            issue.dueDate ? tx(`期限 ${isoToDateInput(issue.dueDate)}`, `Due ${isoToDateInput(issue.dueDate)}`) : "",
                          ].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="max-w-[30%] shrink-0 truncate text-[11px] text-zinc-500 sm:text-xs">
                        {assignees}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-zinc-500">
              {tx("あなたの担当課題はありません", "No issues assigned to you")}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-950 sm:text-lg">{tx("進める", "Move forward")}</h2>
        <ActionLink
          href={`/projects/${projectId}/coach`}
          icon={Sparkles}
          label={tx("AI", "AI")}
          detail={tx("相談もアイデア出しもここから", "Ask or brainstorm from here")}
          filled
        />
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-950 sm:text-lg">{tx("ひらめき", "Create")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <CompactLink href={`/projects/${projectId}/ideas`} icon={Vote} label={tx("投票", "Voting")} />
          <CompactLink href={`/projects/${projectId}/whiteboard`} icon={PenTool} label={tx("ボード", "Board")} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-950 sm:text-lg">{tx("資料", "Files")}</h2>
        <CompactLink href={`/projects/${projectId}/documents`} icon={FileText} label={tx("資料", "Documents")} />
      </section>
      </div>
    </div>
  );
}
