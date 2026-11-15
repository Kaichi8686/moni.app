import { redirect } from "next/navigation";

/** 旧コンテスト入口 → オフィスへ */
export default function ContestPage() {
  redirect("/idea?spark=office");
}
