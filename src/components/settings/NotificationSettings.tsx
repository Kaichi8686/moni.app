"use client";

import { useCallback, useEffect, useState } from "react";
import { IosToggle } from "@/components/settings/IosToggle";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push/clientSubscribe";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = { userId: string; email?: string | null; variant?: "default" | "card" | "embedded" };

export function NotificationSettings({ userId, email, variant = "default" }: Props) {
  const { t, locale, setLocale, tx } = useI18n();
  const [pushOn, setPushOn] = useState(false);
  const [emailWeekly, setEmailWeekly] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const loadPrefs = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("profiles")
      .select("notify_push,notify_email_weekly")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      setPushOn(Boolean((data as { notify_push?: boolean }).notify_push));
      setEmailWeekly(Boolean((data as { notify_email_weekly?: boolean }).notify_email_weekly));
    }
  }, [userId]);

  useEffect(() => {
    void loadPrefs();
  }, [loadPrefs]);

  async function savePrefs(patch: { notify_push?: boolean; notify_email_weekly?: boolean }) {
    if (!supabase) return;
    await supabase.from("profiles").update(patch).eq("id", userId);
  }

  async function togglePush() {
    setBusy(true);
    setMsg("");
    try {
      if (pushOn) {
        await unsubscribeFromPush(userId);
        await savePrefs({ notify_push: false });
        setPushOn(false);
        setMsg(tx("プッシュ通知をオフにしました", "Push disabled"));
      } else {
        const r = await subscribeToPush(userId, locale);
        if (r.ok) {
          await savePrefs({ notify_push: true });
          setPushOn(true);
        }
        setMsg(r.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const rowClass = "flex items-center justify-between gap-3 px-4 py-3.5";
  const divider = "border-b border-zinc-200";
  const labelClass = "text-sm font-normal text-zinc-900";

  const inner = (
    <div>
      <div className={`${rowClass} ${divider}`}>
        <p className={labelClass}>{t("language")}</p>
        <select
          className="h-9 max-w-[9.5rem] shrink-0 rounded-md border border-zinc-300 bg-white px-2 text-sm font-medium text-zinc-800 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10"
          value={locale}
          onChange={(e) => setLocale(e.target.value as "ja" | "en")}
          aria-label={t("language")}
        >
          <option value="ja">{t("japanese")}</option>
          <option value="en">{t("english")}</option>
        </select>
      </div>

      <div className={`${rowClass} ${divider}`}>
        <p className={labelClass}>{tx("プッシュ通知", "Push notifications")}</p>
        <IosToggle
          checked={pushOn}
          disabled={busy}
          label={tx("プッシュ通知", "Push notifications")}
          onChange={() => void togglePush()}
        />
      </div>

      <div className={rowClass}>
        <div className="min-w-0 flex-1 pr-2">
          <p className={labelClass}>{t("emailWeekly")}</p>
          {email ? <p className="mt-0.5 truncate text-xs text-zinc-500">{email}</p> : null}
        </div>
        <IosToggle
          checked={emailWeekly}
          label={t("emailWeekly")}
          onChange={() => {
            const v = !emailWeekly;
            setEmailWeekly(v);
            void savePrefs({ notify_email_weekly: v });
          }}
        />
      </div>

      {msg ? (
        <p className="border-t border-zinc-100 px-4 py-2.5 text-xs font-medium text-zinc-600" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );

  if (variant === "embedded") {
    return inner;
  }

  if (variant === "card") {
    return <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">{inner}</div>;
  }

  return (
    <div className="mt-6">
      <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600">
        {t("notifications")}
      </p>
      <div className="border-y border-zinc-200 bg-white">{inner}</div>
    </div>
  );
}
