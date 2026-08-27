import { supabase } from "@/lib/supabase";
import { phasesJsonToDefinition, roadmapPhasesToPublishJson, userRowToGalleryView } from "@/lib/templates/convert";
import type { GalleryCategory, GalleryTemplateView, UserRoadmapTemplateRow } from "@/lib/templates/types";
import { isRoadmapTemplatesSchemaError } from "@/lib/templates/template-utils";

export async function listPublicRoadmapTemplates(): Promise<{
  templates: GalleryTemplateView[];
  schemaMissing: boolean;
}> {
  if (!supabase) return { templates: [], schemaMissing: false };

  const { data, error } = await supabase
    .from("roadmap_templates")
    .select("*")
    .eq("is_public", true)
    .order("use_count", { ascending: false })
    .limit(60);

  if (isRoadmapTemplatesSchemaError(error)) {
    return { templates: [], schemaMissing: true };
  }
  if (error) throw new Error(error.message);

  const templates: GalleryTemplateView[] = [];
  for (const row of data ?? []) {
    const view = userRowToGalleryView(row as UserRoadmapTemplateRow, "コミュニティ");
    if (view) templates.push(view);
  }
  return { templates, schemaMissing: false };
}

export async function publishRoadmapTemplate(input: {
  userId: string;
  title: string;
  description: string;
  category: GalleryCategory;
  businessType?: string;
  tags: string[];
  thumbnailEmoji: string;
  isPublic: boolean;
  phasesJson: unknown[];
}): Promise<string> {
  if (!supabase) throw new Error("接続設定が見つかりません。");
  if (input.phasesJson.length === 0) throw new Error("フェーズがないため公開できません。");

  const { data, error } = await supabase
    .from("roadmap_templates")
    .insert({
      author_id: input.userId,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      business_type: input.businessType?.trim() || null,
      tags: input.tags,
      thumbnail_emoji: input.thumbnailEmoji,
      is_public: input.isPublic,
      phases_json: input.phasesJson,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export { roadmapPhasesToPublishJson, phasesJsonToDefinition };
