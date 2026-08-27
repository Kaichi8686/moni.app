"use client";

import { useState } from "react";
import type { GalleryCategory } from "@/lib/templates/types";

const CATEGORIES: { id: GalleryCategory; label: string }[] = [
  { id: "app", label: "アプリ・IT" },
  { id: "hardware", label: "ハードウェア" },
  { id: "service", label: "サービス" },
  { id: "food", label: "食品" },
  { id: "event", label: "イベント" },
  { id: "retail", label: "小売" },
  { id: "research", label: "研究" },
  { id: "other", label: "その他" },
];

type Props = {
  open: boolean;
  publishing?: boolean;
  onClose: () => void;
  onPublish: (form: {
    title: string;
    description: string;
    category: GalleryCategory;
    tags: string[];
    thumbnailEmoji: string;
    isPublic: boolean;
  }) => void;
};

export function PublishTemplateModal({ open, publishing, onClose, onPublish }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<GalleryCategory>("other");
  const [tagsText, setTagsText] = useState("");
  const [thumbnailEmoji, setThumbnailEmoji] = useState("📋");
  const [isPublic, setIsPublic] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="閉じる" onClick={onClose} />
      <form
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onSubmit={(e) => {
          e.preventDefault();
          const tags = tagsText
            .split(/[,、\s]+/)
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8);
          onPublish({ title, description, category, tags, thumbnailEmoji, isPublic });
        }}
      >
        <h2 className="text-lg font-bold text-gray-900">ロードマップをテンプレート公開</h2>
        <p className="mt-1 text-xs text-gray-500">フェーズ構成だけが共有されます（個人のタスク詳細は含みません）。</p>

        <label className="mt-4 block text-xs font-medium text-gray-700">
          タイトル
          <input
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
          />
        </label>

        <label className="mt-3 block text-xs font-medium text-gray-700">
          説明
          <textarea
            className="mt-1 min-h-20 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={400}
          />
        </label>

        <label className="mt-3 block text-xs font-medium text-gray-700">
          カテゴリ
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as GalleryCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-700">
            絵文字
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-xl"
              value={thumbnailEmoji}
              onChange={(e) => setThumbnailEmoji(e.target.value.slice(0, 4))}
              maxLength={4}
            />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            タグ（カンマ区切り）
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="MVP, 初心者"
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          ギャラリーに公開する（誰でも閲覧・利用可）
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={publishing || !title.trim()}
            className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {publishing ? "公開中…" : "公開する"}
          </button>
        </div>
      </form>
    </div>
  );
}
