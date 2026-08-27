"use client";

import { useCallback, useEffect, useState } from "react";
import { BookTemplate, Layers, Save, Trash2, X } from "lucide-react";
import { ARCHETYPE_LABELS } from "@/lib/projects/builtinRoadmapTemplates";
import { builtinTemplatesGrouped } from "@/lib/projects/templateDefinition";
import { TemplatePreviewPanel } from "@/components/projects/workspace/templates/TemplatePreviewPanel";
import { ClearRoadmapConfirmDialog } from "@/app/projects/[projectId]/roadmap/templates/_components/ClearRoadmapConfirmDialog";
import {
  applyTemplateToProject,
  clearProjectRoadmapStructure,
  deleteProjectTemplate,
  listProjectTemplates,
  saveProjectAsTemplate,
  type ApplyTemplateMode,
  type TemplateListItem,
} from "@/lib/projects/projectTemplates";
import type { TemplateArchetype } from "@/lib/projects/templateTypes";
import type { RoadmapPhase } from "@/lib/roadmap/types";

const ARCHETYPE_ORDER: TemplateArchetype[] = ["application", "service", "hardware"];

type Tab = "apply" | "save";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  userId: string | null;
  canEdit: boolean;
  phases: RoadmapPhase[];
  projectStart?: string;
  onApplied: () => void | Promise<void>;
};

export function ProjectTemplateModal({
  open,
  onClose,
  projectId,
  userId,
  canEdit,
  phases,
  projectStart,
  onApplied,
}: Props) {
  const [tab, setTab] = useState<Tab>("apply");
  const catalogByArchetype = builtinTemplatesGrouped();
  const [userTemplates, setUserTemplates] = useState<TemplateListItem[]>([]);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<ApplyTemplateMode>("append");
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [savePublic, setSavePublic] = useState(false);
  const [previewItem, setPreviewItem] = useState<TemplateListItem | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await listProjectTemplates(userId);
      setUserTemplates(res.user);
      setSchemaMissing(res.schemaMissing);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "一覧の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    setTab(phases.length === 0 ? "apply" : "apply");
    setSaveName("");
    setSaveDesc("");
    setPreviewItem(null);
    setErr("");
    void loadList();
  }, [open, loadList, phases.length]);

  if (!open) return null;

  async function handleApply(templateId: string) {
    if (!canEdit) return;
    if (mode === "replace" && phases.length > 0) {
      const ok = window.confirm(
        "既存のフェーズとタスクをすべて削除し、この型で置き換えます。よろしいですか？",
      );
      if (!ok) return;
    }
    setBusy(true);
    setErr("");
    try {
      const start = projectStart ? new Date(projectStart) : new Date();
      await applyTemplateToProject({
        projectId,
        templateId,
        mode,
        projectStart: start,
        existingPhases: phases,
      });
      await onApplied();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "適用に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !canEdit) return;
    if (!saveName.trim()) {
      setErr("型の名前を入力してください");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await saveProjectAsTemplate({
        userId,
        projectId,
        name: saveName,
        description: saveDesc,
        phases,
        isPublic: savePublic,
      });
      await loadList();
      setTab("apply");
      setSaveName("");
      setSaveDesc("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleClearRoadmap() {
    if (!canEdit || phases.length === 0) return;
    setBusy(true);
    setErr("");
    try {
      await clearProjectRoadmapStructure(projectId);
      await onApplied();
      setClearConfirmOpen(false);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!userId) return;
    if (!window.confirm("この型を削除しますか？")) return;
    setBusy(true);
    setErr("");
    try {
      await deleteProjectTemplate(id, userId);
      await loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function TemplateCard({ item }: { item: TemplateListItem }) {
    return (
      <li className="flex items-start gap-2 rounded-md border border-[#E5E7EB] bg-white p-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#1A1A1A]">{item.name}</p>
          {item.description ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-[#6B7280]">{item.description}</p>
          ) : null}
          <p className="mt-1 text-[10px] text-[#9CA3AF]">
            {item.phaseCount} フェーズ
            {item.isBuiltin ? " · 標準" : item.isPublic ? " · 公開" : item.isOwn ? " · 自分" : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => setPreviewItem(item)}
            className="rounded-md border border-[#E5E7EB] px-2.5 py-1 text-[11px] font-medium text-[#374151] hover:bg-[#F7F8F8]"
          >
            内容を見る
          </button>
          {canEdit ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleApply(item.id)}
              className="rounded-md bg-[#5E6AD2] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              適用
            </button>
          ) : null}
          {item.isOwn && !item.isBuiltin ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDelete(item.id)}
              className="inline-flex items-center justify-center gap-0.5 rounded-md border border-[#E5E7EB] px-2 py-1 text-[10px] text-[#6B7280] hover:bg-[#F7F8F8]"
              title="削除"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className={`flex max-h-[min(90dvh,720px)] w-full flex-col overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-xl ${previewItem ? "max-w-2xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <div className="flex items-center gap-2">
            <BookTemplate className="h-5 w-5 text-[#5E6AD2]" />
            <h2 className="text-base font-semibold text-[#1A1A1A]">プロジェクトの型</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-[#6B7280] hover:bg-[#F7F8F8]" aria-label="閉じる">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => setTab("apply")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium ${
              tab === "apply" ? "border-b-2 border-[#5E6AD2] text-[#1A1A1A]" : "text-[#6B7280]"
            }`}
          >
            <Layers className="h-4 w-4" />
            型を使う
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setTab("save")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium ${
                tab === "save" ? "border-b-2 border-[#5E6AD2] text-[#1A1A1A]" : "text-[#6B7280]"
              }`}
            >
              <Save className="h-4 w-4" />
              型として保存
            </button>
          ) : null}
        </div>

        {previewItem ? (
          <TemplatePreviewPanel
            item={previewItem}
            onBack={() => setPreviewItem(null)}
            onApply={() => void handleApply(previewItem.id)}
            canEdit={canEdit}
            busy={busy}
          />
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {canEdit && phases.length > 0 ? (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50/60 px-3 py-2.5">
              <p className="text-[12px] font-medium text-rose-900">いまのロードマップの形を消す</p>
              <p className="mt-1 text-[11px] leading-relaxed text-rose-800/90">
                適用済みのフェーズ {phases.length} 件をまとめて削除します（課題は残ります）。
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => setClearConfirmOpen(true)}
                className="mt-2 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-rose-800 hover:bg-rose-50"
              >
                ロードマップの形を削除…
              </button>
            </div>
          ) : null}

          {schemaMissing ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              自分の型を保存するには Supabase で <code className="rounded bg-white px-1">apply_project_templates.sql</code>{" "}
              を実行してください。標準の型はこのまま使えます。
            </p>
          ) : null}

          {err ? (
            <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">{err}</p>
          ) : null}

          {tab === "apply" ? (
            <div className="space-y-4">
              <p className="text-[12px] leading-relaxed text-[#6B7280]">
                「内容を見る」で各フェーズのやることを確認してから適用できます。適用後もフェーズは自由に編集できます。
              </p>
              {canEdit ? (
                <fieldset className="rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2">
                  <legend className="px-1 text-[11px] font-semibold text-[#6B7280]">適用方法</legend>
                  <label className="mt-1 flex cursor-pointer items-center gap-2 text-[12px]">
                    <input
                      type="radio"
                      name="apply-mode"
                      checked={mode === "append"}
                      onChange={() => setMode("append")}
                    />
                    末尾に追加（既存フェーズは残す）
                  </label>
                  <label className="mt-1 flex cursor-pointer items-center gap-2 text-[12px]">
                    <input
                      type="radio"
                      name="apply-mode"
                      checked={mode === "replace"}
                      onChange={() => setMode("replace")}
                    />
                    すべて置き換え
                  </label>
                </fieldset>
              ) : null}

              {loading ? <p className="text-[12px] text-[#6B7280]">読み込み中…</p> : null}

              {ARCHETYPE_ORDER.map((arch) => {
                const meta = ARCHETYPE_LABELS[arch];
                const items = catalogByArchetype[arch];
                return (
                  <section key={arch}>
                    <h3 className="text-[11px] font-semibold text-[#1A1A1A]">
                      {meta.emoji} {meta.label}
                      <span className="ml-1.5 font-normal text-[#9CA3AF]">({items.length})</span>
                    </h3>
                    <p className="mt-0.5 text-[10px] leading-snug text-[#6B7280]">{meta.blurb}</p>
                    <ul className="mt-2 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                      {items.map((item) => (
                        <TemplateCard key={item.id} item={item} />
                      ))}
                    </ul>
                  </section>
                );
              })}

              {userTemplates.length > 0 ? (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">保存した型</h3>
                  <ul className="mt-2 space-y-2">
                    {userTemplates.map((item) => (
                      <TemplateCard key={item.id} item={item} />
                    ))}
                  </ul>
                </section>
              ) : !loading && !schemaMissing && userId ? (
                <p className="text-[12px] text-[#9CA3AF]">まだ保存した型がありません。「型として保存」から作れます。</p>
              ) : null}
            </div>
          ) : (
            <form className="space-y-3" onSubmit={(e) => void handleSave(e)}>
              <p className="text-[12px] leading-relaxed text-[#6B7280]">
                いまのロードマップ（{phases.length} フェーズ）を型として保存し、別プロジェクトや次の挑戦で再利用できます。
              </p>
              {phases.length === 0 ? (
                <p className="rounded-md border border-dashed border-[#E5E7EB] px-3 py-4 text-center text-[12px] text-[#6B7280]">
                  フェーズを追加してから保存してください。
                </p>
              ) : (
                <>
                  <label className="block text-[12px] font-medium text-[#6B7280]">名前</label>
                  <input
                    className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="例: 飲食店ローンチプラン"
                    required
                  />
                  <label className="block text-[12px] font-medium text-[#6B7280]">説明（任意）</label>
                  <textarea
                    className="w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
                    rows={2}
                    value={saveDesc}
                    onChange={(e) => setSaveDesc(e.target.value)}
                    placeholder="いつ使う型か、チーム向けメモ"
                  />
                  <label className="flex items-center gap-2 text-[12px] text-[#374151]">
                    <input type="checkbox" checked={savePublic} onChange={(e) => setSavePublic(e.target.checked)} />
                    チーム全体に公開する（ログイン済みユーザーが適用可能）
                  </label>
                  <button
                    type="submit"
                    disabled={busy || phases.length === 0}
                    className="w-full rounded-md bg-[#5E6AD2] py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? "保存中…" : "型を保存"}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
        )}
      </div>

      <ClearRoadmapConfirmDialog
        open={clearConfirmOpen}
        phaseCount={phases.length}
        busy={busy}
        onCancel={() => !busy && setClearConfirmOpen(false)}
        onConfirm={handleClearRoadmap}
      />
    </div>
  );
}
