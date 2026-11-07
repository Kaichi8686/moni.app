import { redirect } from "next/navigation";

/** 旧コンテスト入口 → アイデアリーグへ */
export default function ContestPage() {
  redirect("/idea?spark=league");
}
