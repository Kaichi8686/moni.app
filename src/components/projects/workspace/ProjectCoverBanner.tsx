"use client";

import { useRef, useState, type ReactNode } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { validateProjectImageFile } from "@/lib/projects/uploadProjectImage";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif";

type Props = {
  backgroundUrl: string;
  canEdit: boolean;
  iconFallback?: ReactNode;
  onUpload: (file: File) => Promise<string | void>;
  /** アイコン横（プロジェクト名・メンバー数など） */
  title: ReactNode;
  /** アイコン行の下（進捗バーなど） */
  children?: ReactNode;
};

/**
 * プロフィール画面の背景バナーと同型。端まで敷き詰め、権限があればその場で差し替えできる。
 */
export function ProjectCoverBanner({
  backgroundUrl,
  canEdit,
  iconFallback,
  onUpload,
  title,
  children,
}: Props) {
  const { tx } = useI18n();
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const url = (preview ?? backgroundUrl)?.trim() || "";

  async function handleUpload(file: File | null) {
    if (!file || !canEdit) return;
    const validationErr = validateProjectImageFile(file);
    if (validationErr) {
      setError(validationErr);
      return;
    }
    setUploading(true);
    setError("");
    try {
      const nextUrl = await onUpload(file);
      if (typeof nextUrl === "string" && nextUrl.trim()) {
        setPreview(nextUrl.trim());
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : tx("背景の変更に失敗しました", "Couldn’t change background"),
      );
    } finally {
      setUploading(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = "";
    }
  }

  return (
    // ワークスペース main の px/py を打ち消し、プロフィール同様に端まで敷く
    <section className="-mx-4 -mt-4 border-b border-zinc-200 bg-white md:-mx-6 md:-mt-5">
      <div className="relative h-44 w-full overflow-hidden bg-zinc-100 sm:h-52">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-owned Supabase image
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
              ref={backgroundInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => backgroundInputRef.current?.click()}
              className="absolute bottom-3 right-3 z-10 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/30 bg-black/45 px-3 text-[12px] font-semibold text-white backdrop-blur-sm transition hover:bg-black/55 disabled:opacity-50"
              aria-label={url ? tx("背景を変更", "Change background") : tx("背景を追加", "Add background")}
              title={url ? tx("背景を変更", "Change background") : tx("背景を追加", "Add background")}
            >
              {url ? <Camera className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {uploading
                ? tx("アップロード中…", "Uploading…")
                : url
                  ? tx("背景を変更", "Change")
                  : tx("背景を追加", "Add")}
            </button>
          </>
        ) : null}
      </div>

      <div className="px-4 pb-5 sm:px-5 md:px-6">
        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="-mt-9 flex items-end gap-4">
            <div className="shrink-0 rounded-[14px] bg-white p-0.5 shadow-sm ring-1 ring-zinc-200/80">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-owned Supabase image
                <img src={url} alt="" className="h-16 w-16 rounded-xl object-cover sm:h-20 sm:w-20" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-orange-100 text-3xl sm:h-20 sm:w-20">
                  {iconFallback ?? "📁"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-0.5 pt-10">{title}</div>
          </div>
          {children}
          {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
