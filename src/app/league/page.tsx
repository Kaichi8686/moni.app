import { redirect } from "next/navigation";

/** 旧アイデアリーグ入口 → オフィスへ（旧テーブル・コードは保持） */
export default function LeaguePage() {
  redirect("/idea?spark=office");
}
