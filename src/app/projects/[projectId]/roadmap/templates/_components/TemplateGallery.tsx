"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseISO } from "date-fns";
import { ARCHETYPE_LABELS } from "@/lib/projects/builtinRoadmapTemplates";
import { builtinTemplateListItems, builtinTemplatesGrouped } from "@/lib/projects/templateDefinition";
import {
  applyTemplateToProject,
  clearProjectRoadmapStructure,
  deleteProjectTemplate,
  listProjectTemplates,
  resolveTemplateDefinition,
  saveProjectAsTemplate,
  type ApplyTemplateMode,
} from "@/lib/projects/projectTemplates";
import type { TemplateArchetype } from "@/lib/projects/templateTypes";
import { ClearRoadmapConfirmDialog } from "@/app/projects/[projectId]/roadmap/templates/_components/ClearRoadmapConfirmDialog";
import { TemplateAiPanel } from "@/app/projects/[projectId]/roadmap/templates/_components/TemplateAiPanel";
import { TemplateCard } from "@/app/projects/[projectId]/roadmap/templates/_components/TemplateCard";
import { TemplatePreviewModal } from "@/app/projects/[projectId]/roadmap/templates/_components/TemplatePreviewModal";
import { PublishTemplateModal } from "@/app/projects/[projectId]/roadmap/templates/_components/PublishTemplateModal";
import {
  projectDefinitionToPhases,
  systemTemplateToGalleryView,
  templateListItemToGalleryView,
} from "@/lib/templates/convert";
import { listPublicRoadmapTemplates, publishRoadmapTemplate, roadmapPhasesToPublishJson } from "@/lib/templates/roadmapTemplatesApi";
import { SYSTEM_TEMPLATES } from "@/lib/templates/system-templates";
import { applyGalleryTemplate } from "@/lib/templates/template-utils";
import type { GalleryCategory, GalleryTemplateView } from "@/lib/templates/types";
import { supabase } from "@/lib/supabase";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";

const CATEGORY_FILTERS = [
  { id: "all", label: "すべて", icon: "✨" },
  { id: "app", label: "アプリ・IT", icon: "📱" },
  { id: "hardware", label: "ハードウェア", icon: "🔧" },
  { id: "service", label: "サービス", icon: "🤝" },
] as const;

const MAIN_TABS = [
  { id: "ai", label: "AIで作る", icon: "✨" },
  { id: "business", label: "ビジネス", icon: "🚀" },
  { id: "framework", label: "書籍・フレームワーク", icon: "📚" },
  { id: "saved", label: "保存した型", icon: "💾" },
  { id: "community", label: "みんなの公開", icon: "🌐" },
] as const;

type MainTab = (typeof MAIN_TABS)[number]["id"];
const ARCHETYPE_ORDER: TemplateArchetype[] = ["application", "service", "hardware"];

type Props = {
  projectId: string;
};

export function TemplateGallery({ projectId }: Props) {
  const router = useRouter();
  const roadmap = useRoadmapProject(projectId);
  const [mainTab, setMainTab] = useState<MainTab>("ai");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selected, setSelected] = useState<GalleryTemplateView | null>(null);
  const [applyMode, setApplyMode] = useState<ApplyTemplateMode>("append");
  const [communityTemplates, setCommunityTemplates] = useState<GalleryTemplateView[]>([]);
  const [savedProjectTemplates, setSavedProjectTemplates] = useState<GalleryTemplateView[]>([]);
  const [communitySchemaMissing, setCommunitySchemaMissing] = useState(false);
  const [projectSchemaMissing, setProjectSchemaMissing] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [savePublic, setSavePublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const businessTemplates = useMemo(() => SYSTEM_TEMPLATES.map(systemTemplateToGalleryView), []);

  const frameworkByArchetype = useMemo(() => {
    const grouped = builtinTemplatesGrouped();
    const out: Record<TemplateArchetype, GalleryTemplateView[]> = {
      application: [],
      service: [],
      hardware: [],
    };
    for (const arch of ARCHETYPE_ORDER) {
      out[arch] = grouped[arch].map((item) =>
        templateListItemToGalleryView(item, []),
      );
    }
    return out;
  }, []);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [community, project] = await Promise.all([
        listPublicRoadmapTemplates(),
        listProjectTemplates(uid),
      ]);
      setCommunityTemplates(community.templates);
      setCommunitySchemaMissing(community.schemaMissing);
      setSavedProjectTemplates(
        project.user.map((item) => templateListItemToGalleryView(item, [])),
      );
      setProjectSchemaMissing(project.schemaMissing);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "テンプレートの読み込みに失敗しました");
    } finally {
      setLoadingLists(false);
    }
  }, [uid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "ai" || tab === "business" || tab === "framework" || tab === "saved" || tab === "community") {
      setMainTab(tab);
    }
  }, []);

  useEffect(() => {
    void loadLists();
    void (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      setUid(data.session?.user.id ?? null);
    })();
  }, [loadLists]);

  const filterCategory = (t: GalleryTemplateView) =>
    activeCategory === "all" || t.category === activeCategory;

  const filteredBusiness = businessTemplates.filter(filterCategory);
  const filteredCommunity = communityTemplates.filter(filterCategory);
  const filteredSaved = savedProjectTemplates.filter(filterCategory);

  const projectStart = roadmap.project?.startDate
    ? parseISO(roadmap.project.startDate.slice(0, 10))
    : new Date();

  const openTemplate = useCallback(async (template: GalleryTemplateView) => {
    if (template.source === "project" && template.phases.length === 0 && template.projectTemplateId) {
      setPreviewLoading(true);
      setMessage("");
      try {
        const def = await resolveTemplateDefinition(template.projectTemplateId);
        if (!def) {
          setMessage("テンプレートの内容を読み込めませんでした");
          return;
        }
        setSelected({
          ...template,
          phases: projectDefinitionToPhases(def),
          phaseCount: def.phases.length,
        });
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "読み込みに失敗しました");
      } finally {
        setPreviewLoading(false);
      }
      return;
    }
    setSelected(template);
  }, []);

  const handleApply = async () => {
    if (!selected || !roadmap.canEdit) return;
    if (applyMode === "replace" && roadmap.phases.length > 0) {
      const ok = window.confirm("既存のフェーズとタスクをすべて削除して、このテンプレートで置き換えます。よろしいですか？");
      if (!ok) return;
    }

    setApplying(true);
    setMessage("");
    try {
      let issuesCreated = 0;
      if (selected.source === "project" && selected.projectTemplateId) {
        const r = await applyTemplateToProject({
          projectId,
          templateId: selected.projectTemplateId,
          mode: applyMode,
          projectStart,
          existingPhases: roadmap.phases,
        });
        issuesCreated = r.issuesCreated;
      } else {
        const r = await applyGalleryTemplate({
          projectId,
          template: selected,
          projectStart,
          existingPhases: roadmap.phases,
          userId: uid,
          replaceExisting: applyMode === "replace",
        });
        issuesCreated = r.issuesCreated;
      }
      if (issuesCreated > 0) {
        setMessage(`適用しました。課題を ${issuesCreated} 件作成しました（各課題に解決ステップ付き）。`);
      }
      setSelected(null);
      router.push(`/projects/${projectId}/roadmap`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "適用に失敗しました");
    } finally {
      setApplying(false);
    }
  };

  const handlePublish = async (form: {
    title: string;
    description: string;
    category: GalleryCategory;
    tags: string[];
    thumbnailEmoji: string;
    isPublic: boolean;
  }) => {
    if (!uid) {
      setMessage("ログインが必要です");
      return;
    }
    if (roadmap.phases.length === 0) {
      setMessage("公開するフェーズがありません");
      return;
    }
    setPublishing(true);
    setMessage("");
    try {
      await publishRoadmapTemplate({
        userId: uid,
        title: form.title,
        description: form.description,
        category: form.category,
        tags: form.tags,
        thumbnailEmoji: form.thumbnailEmoji,
        isPublic: form.isPublic,
        phasesJson: roadmapPhasesToPublishJson(roadmap.phases),
      });
      setPublishOpen(false);
      setMessage(form.isPublic ? "ギャラリーに公開しました" : "非公開で保存しました");
      await loadLists();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "公開に失敗しました");
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveProjectTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !roadmap.canEdit || !saveName.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      await saveProjectAsTemplate({
        userId: uid,
        projectId,
        name: saveName,
        description: saveDesc,
        phases: roadmap.phases,
        isPublic: savePublic,
      });
      setSaveName("");
      setSaveDesc("");
      setMessage("型として保存しました");
      await loadLists();
      setMainTab("saved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSaved = async (templateId: string) => {
    if (!uid || !window.confirm("この型を削除しますか？")) return;
    try {
      await deleteProjectTemplate(templateId, uid);
      await loadLists();
      if (selected?.projectTemplateId === templateId) setSelected(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const handleClearRoadmap = async () => {
    if (!roadmap.canEdit || roadmap.phases.length === 0) return;
    setClearing(true);
    setMessage("");
    try {
      await clearProjectRoadmapStructure(projectId);
      await roadmap.reload();
      setClearConfirmOpen(false);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setClearing(false);
    }
  };

  const showCategoryFilters = mainTab === "business" || mainTab === "community";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/projects/${projectId}/roadmap`} className="text-xs font-medium text-violet-600 hover:underline">
            ← ロードマップに戻る
          </Link>
          <h1 className="mt-2 text-xl font-bold text-gray-900">テンプレート</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            AIでオリジナルプランを作るか、ビジネス・書籍の型・保存した型から選んで適用できます
          </p>
        </div>
        {roadmap.canEdit && roadmap.phases.length > 0 ? (
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
          >
            ギャラリーに公開
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">{message}</p>
      ) : null}

      {previewLoading ? (
        <p className="mb-4 text-sm text-gray-500">プレビューを読み込み中…</p>
      ) : null}

      {roadmap.canEdit && roadmap.phases.length > 0 ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50/60 px-4 py-3">
          <p className="text-xs font-medium text-rose-900">いまのロードマップ（{roadmap.phases.length} フェーズ）</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <fieldset className="flex flex-wrap gap-3 text-xs text-gray-700">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="apply-mode"
                  checked={applyMode === "append"}
                  onChange={() => setApplyMode("append")}
                />
                末尾に追加
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="apply-mode"
                  checked={applyMode === "replace"}
                  onChange={() => setApplyMode("replace")}
                />
                すべて置き換え
              </label>
            </fieldset>
            <button
              type="button"
              onClick={() => setClearConfirmOpen(true)}
              className="rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-50"
            >
              フェーズをすべて削除
            </button>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMainTab(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              mainTab === tab.id ? "bg-white text-violet-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {showCategoryFilters ? (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                activeCategory === cat.id ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      ) : null}

      {mainTab === "ai" ? (
        <TemplateAiPanel
          projectId={projectId}
          projectName={roadmap.project?.name ?? "プロジェクト"}
          projectDescription={roadmap.project?.description}
          phases={roadmap.phases}
          phasesCount={roadmap.phases.length}
          canEdit={roadmap.canEdit}
          onReload={roadmap.reload}
        />
      ) : null}

      {mainTab === "business" ? (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            ビジネステンプレート（moni公式・15種）
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBusiness.map((template) => (
              <TemplateCard key={template.id} template={template} onClick={() => void openTemplate(template)} />
            ))}
          </div>
        </section>
      ) : null}

      {mainTab === "framework" ? (
        <div className="space-y-8">
          <p className="text-sm text-gray-500">
            リーン・スタートアップ、BMC、NPI など書籍・フレームワークに沿った型です（従来の「プロジェクトの型」）。
          </p>
          {ARCHETYPE_ORDER.map((arch) => {
            const meta = ARCHETYPE_LABELS[arch];
            const items = frameworkByArchetype[arch].filter(filterCategory);
            if (items.length === 0) return null;
            return (
              <section key={arch}>
                <h2 className="text-sm font-semibold text-gray-900">
                  {meta.emoji} {meta.label}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">{meta.blurb}</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((template) => (
                    <TemplateCard key={template.id} template={template} onClick={() => void openTemplate(template)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {mainTab === "saved" ? (
        <div className="space-y-8">
          {roadmap.canEdit ? (
            <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h2 className="text-sm font-semibold text-gray-900">いまのロードマップを型として保存</h2>
              <p className="mt-1 text-xs text-gray-500">
                別プロジェクトや次の挑戦で再利用できます（{roadmap.phases.length} フェーズ）。
              </p>
              {projectSchemaMissing ? (
                <p className="mt-2 text-xs text-amber-800">
                  <code>apply_project_templates.sql</code> を Supabase で実行してください。
                </p>
              ) : null}
              {roadmap.phases.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">フェーズを追加してから保存できます。</p>
              ) : (
                <form className="mt-4 space-y-3" onSubmit={(e) => void handleSaveProjectTemplate(e)}>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="型の名前（例: 飲食店ローンチ）"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    required
                  />
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="説明（任意）"
                    value={saveDesc}
                    onChange={(e) => setSaveDesc(e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" checked={savePublic} onChange={(e) => setSavePublic(e.target.checked)} />
                    ログイン済みユーザーに公開する
                  </label>
                  <button
                    type="submit"
                    disabled={saving || !saveName.trim()}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? "保存中…" : "型を保存"}
                  </button>
                </form>
              )}
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">保存した型</h2>
            {loadingLists ? (
              <p className="text-sm text-gray-500">読み込み中…</p>
            ) : filteredSaved.length === 0 ? (
              <p className="text-sm text-gray-500">まだ保存した型がありません。</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSaved.map((template) => (
                  <div key={template.id} className="relative">
                    <TemplateCard template={template} onClick={() => void openTemplate(template)} />
                    {template.projectTemplateId && uid ? (
                      <button
                        type="button"
                        className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[10px] text-gray-600 shadow hover:bg-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteSaved(template.projectTemplateId!);
                        }}
                      >
                        削除
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {!loadingLists && savedProjectTemplates.length === 0 && !projectSchemaMissing ? (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                標準の型（書籍・フレームワーク）
              </h2>
              <p className="mb-3 text-sm text-gray-500">
                ログイン前でも使える組み込み型です。「書籍・フレームワーク」タブからも選べます。
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {builtinTemplateListItems()
                  .slice(0, 6)
                  .map((item) => (
                    <TemplateCard
                      key={item.id}
                      template={templateListItemToGalleryView(item, [])}
                      onClick={() => void openTemplate(templateListItemToGalleryView(item, []))}
                    />
                  ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {mainTab === "community" ? (
        <section>
          {communitySchemaMissing ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              コミュニティ公開用の DB が未適用です。Supabase で{" "}
              <code className="text-xs">apply_roadmap_template_gallery.sql</code> を実行してください。
            </p>
          ) : null}
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">みんなのテンプレート</h2>
          {loadingLists ? (
            <p className="text-sm text-gray-500">読み込み中…</p>
          ) : filteredCommunity.length === 0 ? (
            <p className="text-sm text-gray-500">まだ公開テンプレートがありません。</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCommunity.map((template) => (
                <TemplateCard key={template.id} template={template} onClick={() => void openTemplate(template)} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {selected ? (
        <TemplatePreviewModal
          template={selected}
          applying={applying}
          onClose={() => setSelected(null)}
          onApply={() => void handleApply()}
        />
      ) : null}

      <PublishTemplateModal
        open={publishOpen}
        publishing={publishing}
        onClose={() => setPublishOpen(false)}
        onPublish={(form) => void handlePublish(form)}
      />

      <ClearRoadmapConfirmDialog
        open={clearConfirmOpen}
        phaseCount={roadmap.phases.length}
        busy={clearing}
        onCancel={() => !clearing && setClearConfirmOpen(false)}
        onConfirm={handleClearRoadmap}
      />
    </div>
  );
}
