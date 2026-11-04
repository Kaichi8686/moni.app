import { redirect } from "next/navigation";

/** 旧URL互換 → AIタブのコンテスト側へ */
export default function ContestPage() {
  redirect("/idea?spark=contest");
}
