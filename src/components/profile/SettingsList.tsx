"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  Flag,
  HelpCircle,
  Lock,
  Paintbrush,
  UserCircle,
} from "lucide-react";
import { AppAdminDashboard } from "@/components/admin/AppAdminDashboard";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { SettingsRow, type SettingsItem } from "@/components/settings/SettingsRow";
import { isAppAdminUser } from "@/lib/auth/appAdmin";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const OPEN_KEY = "moni-settings-open-sections";

function loadOpenMap(): Record<string, boolean> {
  if (typeof window === "undefined") return { profile: true, notifications: true };
  try {
    const raw = window.localStorage.getItem(OPEN_KEY);
    if (!raw) return { profile: true, notifications: true };
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return { profile: true, notifications: true };
  }
}

export function SettingsList() {
  const router = useRouter();
  const { tx, locale } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({
    profile: true,
    privacy: false,
    support: false,
    notifications: true,
  });

  useEffect(() => {
    setOpenMap(loadOpenMap());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    void client.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (!data.session) return;
      const { data: profile } = await client
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      setRole((profile?.role as string) ?? null);
    });
  }, []);

  const isAdmin = isAppAdminUser({ email: session?.user.email, role });

  const settingsGroups: { id: string; title: string; items: SettingsItem[] }[] = [
    {
      id: "profile",
      title: tx("プロフィール", "Profile"),
      items: [
        {
          icon: UserCircle,
          label: tx("プロフィールを編集", "Edit profile"),
          description: tx("名前・bio・写真・リンク", "Name, bio, photo, links"),
          href: "/profile/edit",
          color: "#18181B",
        },
        {
          icon: Paintbrush,
          label: tx("プロフィールを見る", "View profile"),
          description: tx("公開プロフィールのプレビュー", "Preview your public profile"),
          href: "/profile",
          color: "#3F3F46",
        },
      ],
    },
    {
      id: "privacy",
      title: tx("プライバシーと安全", "Privacy & safety"),
      items: [
        {
          icon: Lock,
          label: tx("ログイン", "Log in"),
          description: tx("アカウントの切り替え", "Switch account"),
          href: "/login",
          color: "#059669",
        },
      ],
    },
    {
      id: "support",
      title: tx("サポート", "Support"),
      items: [
        {
          icon: HelpCircle,
          label: tx("ランディングを見る", "About moni"),
          description: tx("サービスの説明ページ", "Product overview"),
          href: "/?landing=1",
          color: "#52525B",
        },
        {
          icon: Flag,
          label: tx("不具合を報告", "Report a problem"),
          href: "mailto:support@moni.app?subject=不具合報告",
          color: "#52525B",
        },
      ],
    },
  ];

  function toggleSection(id: string) {
    setOpenMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[#FAFAFA] pb-bottom-nav text-zinc-900 antialiased">
      <header className="flex shrink-0 items-center gap-2 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-zinc-100"
          aria-label={tx("戻る", "Back")}
        >
          <ChevronLeft className="h-5 w-5 text-zinc-900" />
        </button>
        <h1 className="moni-wordmark text-lg">moni</h1>
      </header>

      {session && isAdmin ? (
        <div className="shrink-0 border-b border-[#E5E7EB] bg-white p-4 sm:px-6">
          <AppAdminDashboard session={session} language={locale} />
        </div>
      ) : null}

      <nav
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-0 py-2"
        aria-label={tx("設定メニュー", "Settings menu")}
      >
        <ul className="flex w-full flex-1 flex-col">
          {settingsGroups.map((group) => {
            const open = Boolean(openMap[group.id]);
            return (
              <li key={group.id} className="border-b border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => toggleSection(group.id)}
                  className={`flex w-full items-center gap-2 px-4 py-3.5 text-left transition hover:bg-white sm:px-6 ${
                    open ? "bg-white" : "bg-[#FAFAFA]"
                  }`}
                  aria-expanded={open}
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#6B7280] transition-transform ${open ? "" : "-rotate-90"}`}
                    aria-hidden
                  />
                  <span className="text-[14px] font-bold text-[#1A1A1A]">{group.title}</span>
                  <span className="ml-auto text-[11px] font-medium text-[#9CA3AF]">{group.items.length}</span>
                </button>
                {open ? (
                  <ul className="bg-white pb-1">
                    {group.items.map((item, i) => (
                      <li key={item.label}>
                        <SettingsRow item={item} isLast={i === group.items.length - 1} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}

          {session ? (
            <li className="border-b border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => toggleSection("notifications")}
                className={`flex w-full items-center gap-2 px-4 py-3.5 text-left transition hover:bg-white sm:px-6 ${
                  openMap.notifications ? "bg-white" : "bg-[#FAFAFA]"
                }`}
                aria-expanded={Boolean(openMap.notifications)}
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-[#6B7280] transition-transform ${
                    openMap.notifications ? "" : "-rotate-90"
                  }`}
                  aria-hidden
                />
                <Bell className="h-4 w-4 text-[#6B7280]" aria-hidden />
                <span className="text-[14px] font-bold text-[#1A1A1A]">{tx("通知・言語", "Notifications & language")}</span>
              </button>
              {openMap.notifications ? (
                <div className="bg-white">
                  <NotificationSettings
                    userId={session.user.id}
                    email={session.user.email}
                    variant="embedded"
                  />
                </div>
              ) : null}
            </li>
          ) : null}
        </ul>

        <div className="mt-auto space-y-3 px-4 py-5 sm:px-6">
          {session ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full rounded-lg border border-rose-200 bg-rose-50 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100 active:scale-[0.99]"
            >
              {tx("ログアウト", "Log out")}
            </button>
          ) : null}
          <p className="text-center text-xs font-medium text-zinc-500">moni v2.0.0</p>
        </div>
      </nav>
    </div>
  );
}
