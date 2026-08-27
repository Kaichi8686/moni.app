"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminStatsPayload } from "@/lib/admin/types";
import type { Session } from "@supabase/supabase-js";

type Props = {
  session: Session;
  language: "ja" | "en";
};

const ROLE_LABELS: Record<string, string> = {
  child: "子ども",
  parent: "保護者",
  investor: "投資家/起業家",
  admin: "運営管理者",
};

function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(locale, {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AppAdminDashboard({ session, language }: Props) {
  const locale = language === "ja" ? "ja-JP" : "en-US";
  const [stats, setStats] = useState<AdminStatsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const body = (await res.json()) as AdminStatsPayload & { error?: string };
      if (!res.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        setStats(null);
        return;
      }
      setStats(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [session.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteUsers(body: { userId?: string; purgeOthers?: boolean; deleteVirtualDemo?: boolean }) {
    setActionMessage("");
    const id = body.userId;
    if (id) setDeletingId(id);
    else setPurging(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        deletedCount?: number;
        failed?: Array<{ id: string; message: string }>;
      };
      if (!res.ok) {
        setActionMessage(data.error ?? `HTTP ${res.status}`);
        return;
      }
      const failed = data.failed?.length ?? 0;
      const ok = data.deletedCount ?? 0;
      setActionMessage(
        language === "ja"
          ? `${ok} 件のユーザーを削除しました。${failed > 0 ? `（${failed} 件は失敗）` : ""}`
          : `Deleted ${ok} user(s).${failed > 0 ? ` (${failed} failed)` : ""}`,
      );
      setPurgeConfirmOpen(false);
      setPurgeConfirmText("");
      await load();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : language === "ja" ? "削除に失敗しました" : "Delete failed");
    } finally {
      setDeletingId(null);
      setPurging(false);
    }
  }

  const title = language === "ja" ? "運営ダッシュボード" : "Admin dashboard";
  const subtitle =
    language === "ja"
      ? "登録ユーザー数・ロール内訳・直近の利用状況を確認できます。"
      : "User counts, roles, and recent activity.";

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-violet-900">{title}</p>
          <p className="mt-1 text-[11px] text-violet-800/80">{subtitle}</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-violet-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-900 hover:bg-violet-50"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (language === "ja" ? "更新中…" : "Loading…") : language === "ja" ? "再読み込み" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
          {error.includes("SERVICE_ROLE") ? (
            <span className="mt-1 block text-[11px]">
              Vercel の環境変数に <code className="text-[10px]">SUPABASE_SERVICE_ROLE_KEY</code> を追加してください。
            </span>
          ) : null}
        </p>
      ) : null}

      {actionMessage ? (
        <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">{actionMessage}</p>
      ) : null}

      {stats ? (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: language === "ja" ? "登録ユーザー" : "Users", value: stats.totals.authUsers },
              { label: language === "ja" ? "プロフィール" : "Profiles", value: stats.totals.profiles },
              { label: language === "ja" ? "7日以内ログイン" : "Active (7d)", value: stats.activeLast7Days },
              { label: language === "ja" ? "プロジェクト" : "Projects", value: stats.totals.projects },
              { label: language === "ja" ? "投稿" : "Posts", value: stats.totals.posts },
              { label: language === "ja" ? "記事" : "Articles", value: stats.totals.articles },
              { label: language === "ja" ? "ピッチ" : "Pitches", value: stats.totals.pitches },
              { label: language === "ja" ? "チャット" : "Chat msgs", value: stats.totals.chatMessages },
              { label: language === "ja" ? "フォロー" : "Follows", value: stats.totals.follows },
            ].map((card) => (
              <div key={card.label} className="rounded-lg border border-violet-100 bg-white px-3 py-2">
                <p className="text-[10px] font-medium text-violet-700/90">{card.label}</p>
                <p className="text-lg font-semibold tabular-nums text-violet-950">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-violet-100 bg-white p-2">
              <p className="text-[11px] font-semibold text-violet-900">
                {language === "ja" ? "ロール内訳" : "Roles"}
              </p>
              <ul className="mt-1 space-y-1 text-[11px] text-violet-900/90">
                {stats.roleBreakdown.length === 0 ? (
                  <li>—</li>
                ) : (
                  stats.roleBreakdown.map((r) => (
                    <li key={r.role} className="flex justify-between gap-2">
                      <span>{ROLE_LABELS[r.role] ?? r.role}</span>
                      <span className="tabular-nums font-medium">{r.count}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-lg border border-violet-100 bg-white p-2">
              <p className="text-[11px] font-semibold text-violet-900">
                {language === "ja" ? "新規登録（14日）" : "Signups (14d)"}
              </p>
              <ul className="mt-1 space-y-1 text-[11px] text-violet-900/90">
                {stats.signupsLast14Days.map((row) => (
                  <li key={row.day} className="flex items-center gap-2">
                    <span className="w-20 tabular-nums">{row.day.slice(5)}</span>
                    <span
                      className="h-2 rounded bg-violet-400/30"
                      style={{ width: `${Math.min(100, row.count * 12)}px` }}
                    />
                    <span className="tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-violet-100 bg-white">
            <p className="border-b border-violet-100 px-3 py-2 text-[11px] font-semibold text-violet-900">
              {language === "ja" ? "ユーザー一覧（新しい順）" : "Users (newest)"}
            </p>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-violet-50/95 text-violet-800">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">{language === "ja" ? "名前" : "Name"}</th>
                    <th className="px-2 py-1.5 font-semibold">Email</th>
                    <th className="px-2 py-1.5 font-semibold">{language === "ja" ? "種類" : "Role"}</th>
                    <th className="px-2 py-1.5 font-semibold text-right">PJ</th>
                    <th className="px-2 py-1.5 font-semibold text-right">
                      {language === "ja" ? "投稿" : "Posts"}
                    </th>
                    <th className="px-2 py-1.5 font-semibold">{language === "ja" ? "最終ログイン" : "Last in"}</th>
                    <th className="px-2 py-1.5 font-semibold text-right">{language === "ja" ? "操作" : ""}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-50">
                  {stats.recentUsers.map((u) => {
                    const isSelf = u.id === session.user.id;
                    return (
                      <tr key={u.id} className="text-violet-950/90">
                        <td className="max-w-[88px] truncate px-2 py-1.5 font-medium">
                          {u.displayName?.trim() || "—"}
                          {isSelf ? (
                            <span className="ml-1 text-[10px] text-violet-600">
                              {language === "ja" ? "（自分）" : "(you)"}
                            </span>
                          ) : null}
                        </td>
                        <td className="max-w-[120px] truncate px-2 py-1.5 text-violet-800/80">{u.email ?? "—"}</td>
                        <td className="px-2 py-1.5">{ROLE_LABELS[u.role] ?? u.role}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{u.projectCount}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{u.postCount}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-violet-800/75">
                          {formatDateTime(u.lastSignInAt, locale)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {isSelf ? (
                            <span className="text-[10px] text-violet-500">—</span>
                          ) : (
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                              disabled={Boolean(deletingId) || purging}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    language === "ja"
                                      ? `${u.displayName || u.email || u.id} を削除しますか？\n投稿・プロジェクトも消えます。`
                                      : `Delete ${u.displayName || u.email || u.id}?`,
                                  )
                                ) {
                                  return;
                                }
                                void deleteUsers({ userId: u.id });
                              }}
                            >
                              {deletingId === u.id
                                ? language === "ja"
                                  ? "削除中…"
                                  : "…"
                                : language === "ja"
                                  ? "削除"
                                  : "Delete"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50/80 p-3">
            <p className="text-[11px] font-semibold text-rose-900">
              {language === "ja" ? "本番前のデータ整理" : "Pre-launch cleanup"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-800/90">
              {language === "ja"
                ? "ゆい・みさき等のデモ仮想ユーザーだけを削除するか、管理者以外をすべて削除できます。取り消せません。"
                : "Delete demo virtual users only, or all except your admin account."}
            </p>
            <button
              type="button"
              className="mt-2 rounded-lg border border-violet-300 bg-white px-3 py-2 text-[11px] font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
              disabled={purging || Boolean(deletingId)}
              onClick={() => {
                if (
                  !window.confirm(
                    language === "ja"
                      ? "ゆい・みさき等の仮想デモユーザーだけを削除しますか？"
                      : "Delete virtual demo users (Yui, Misaki, etc.)?",
                  )
                ) {
                  return;
                }
                void deleteUsers({ deleteVirtualDemo: true });
              }}
            >
              {language === "ja" ? "仮想デモユーザーだけ削除" : "Delete virtual demo users"}
            </button>
            {!purgeConfirmOpen ? (
              <button
                type="button"
                className="mt-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                disabled={purging || Boolean(deletingId) || stats.totals.authUsers <= 1}
                onClick={() => setPurgeConfirmOpen(true)}
              >
                {language === "ja" ? "自分以外のユーザーをすべて削除" : "Delete all other users"}
              </button>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-rose-800">
                  {language === "ja"
                    ? `確認のため「削除」と入力してください（対象: ${Math.max(0, stats.totals.authUsers - 1)} 人）`
                    : `Type 削除 to confirm (${Math.max(0, stats.totals.authUsers - 1)} users)`}
                </p>
                <input
                  className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-base text-rose-950 outline-none focus:border-rose-400"
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  placeholder={language === "ja" ? "削除" : "削除"}
                  autoComplete="off"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    disabled={purging || purgeConfirmText.trim() !== "削除"}
                    onClick={() => void deleteUsers({ purgeOthers: true })}
                  >
                    {purging
                      ? language === "ja"
                        ? "削除中…"
                        : "Deleting…"
                      : language === "ja"
                        ? "実行する"
                        : "Confirm"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-[11px] font-semibold text-rose-800"
                    disabled={purging}
                    onClick={() => {
                      setPurgeConfirmOpen(false);
                      setPurgeConfirmText("");
                    }}
                  >
                    {language === "ja" ? "キャンセル" : "Cancel"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="mt-2 text-[10px] text-violet-700/70">
            {language === "ja" ? "集計時刻" : "Generated"}: {formatDateTime(stats.generatedAt, locale)}
          </p>
        </>
      ) : loading && !error ? (
        <p className="mt-3 text-xs text-violet-800/80">{language === "ja" ? "読み込み中…" : "Loading…"}</p>
      ) : null}
    </div>
  );
}
