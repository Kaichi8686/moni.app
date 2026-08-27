export type ProjectDocumentRow = {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  updated_by: string | null;
};

export function plainTextFromDocContent(htmlOrText: string): string {
  const s = htmlOrText.trim();
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function wordCountFromDocContent(htmlOrText: string): number {
  const t = plainTextFromDocContent(htmlOrText);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** A4 縦横比（210:297）に合わせた最小幅のページ高さ（px） */
export function a4MinHeightForWidth(widthPx: number): number {
  return Math.round(widthPx * (297 / 210));
}
