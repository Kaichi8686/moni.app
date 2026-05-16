import type { BlockedReasonCode } from "@/lib/projects/types";

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
        message: "5分だけ調べる・またはタスクをもう一段小さくすると、着手しやすくなります。",
        links: [
          { label: "質問・相談（コミュニティ）", href: "/?tab=posts&community=qna" },
          { label: "おためし検証", href: "/?tab=mentor&mentor=validation" },
        ],
      };
    case "need_help":
      return {
        message: "頼れる人・チャットで「やってほしいこと」を一文にすると進みやすいです。",
        links: [
          { label: "探す（チャット）", href: "/?tab=chat" },
          { label: "進捗共有", href: "/?tab=posts&community=progress" },
        ],
      };
    case "missing_info":
      return {
        message: "知りたいことを1つに絞ってメモすると、次に聞くべきことが見えます。",
        links: [
          { label: "質問・相談", href: "/?tab=posts&community=qna" },
          { label: "知恵を集める", href: "/?tab=posts&community=qna" },
        ],
      };
    case "no_time":
      return {
        message: "今日は5分版だけに縮めるか、「待ち」にして期限を置き直すのも合理的です。",
        links: [{ label: "スケジュールを調整", href: "#schedule" }],
      };
    case "low_confidence":
      return {
        message: "まずは下書きでも共有すると、反応がもらえて前に進みやすくなります。",
        links: [
          { label: "進捗共有", href: "/?tab=posts&community=progress" },
          { label: "おためし検証", href: "/?tab=mentor&mentor=validation" },
        ],
      };
    default:
      return { message: "", links: [] };
  }
}
