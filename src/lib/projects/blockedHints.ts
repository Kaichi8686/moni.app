import type { BlockedReasonCode } from "@/lib/projects/types";
import { IDEA_QNA_HREF } from "@/lib/navigation/homeProjects";

export const BLOCKED_REASON_OPTIONS: Array<{ code: BlockedReasonCode; label: string }> = [
  { code: "unknown_how", label: "やり方が分からない" },
  { code: "need_help", label: "一人ではできない" },
  { code: "missing_info", label: "情報が足りない" },
  { code: "no_time", label: "時間がない" },
  { code: "low_confidence", label: "自信がない" },
];

export function blockedRestartHint(code: BlockedReasonCode): {
  message: string;
  links: Array<{ label: string; href: string }>;
} {
  switch (code) {
    case "unknown_how":
      return {
        message: "手順を調べる、またはタスクをもっと小さく分けると進めやすくなります。",
        links: [
          { label: "コミュニティで質問", href: IDEA_QNA_HREF },
          { label: "反応を聞いてみる", href: "/?tab=mentor&mentor=validation" },
        ],
      };
    case "need_help":
      return {
        message: "プロジェクト内チャットで、やってほしいことを一文で伝えると動きやすくなります。",
        links: [
          { label: "仲間・プロジェクトを探す", href: "/?tab=chat" },
          { label: "アイデアを見つける", href: "/idea" },
        ],
      };
    case "missing_info":
      return {
        message: "知りたいことを一つに書き出すと、次に聞く内容がはっきりします。",
        links: [{ label: "コミュニティで質問", href: IDEA_QNA_HREF }],
      };
    case "no_time":
      return {
        message: "時間を短く見積もるか、状態を「保留」にして後日にずらすこともできます。",
        links: [{ label: "このページのスケジュールへ", href: "#schedule" }],
      };
    case "low_confidence":
      return {
        message: "下書きでも共有すると、フィードバックをもらいやすくなります。",
        links: [
          { label: "質問・相談する", href: IDEA_QNA_HREF },
          { label: "反応を聞いてみる", href: "/?tab=mentor&mentor=validation" },
        ],
      };
    default:
      return { message: "", links: [] };
  }
}
