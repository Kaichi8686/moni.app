"use client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function tx(locale: "ja" | "en" | undefined, ja: string, en: string) {
  return locale === "en" ? en : ja;
}

export async function subscribeToPush(
  userId: string,
  locale?: "ja" | "en",
): Promise<{ ok: boolean; message: string }> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      ok: false,
      message: tx(locale, "このブラウザはプッシュ通知に対応していません", "This browser does not support push notifications"),
    };
  }

  const vapidRes = await fetch("/api/push/vapid-public");
  const { publicKey } = (await vapidRes.json()) as { publicKey?: string };
  if (!publicKey) {
    return {
      ok: false,
      message: tx(locale, "VAPID キーが未設定です（管理者に連絡）", "VAPID key is not set (contact an admin)"),
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: tx(locale, "通知が許可されませんでした", "Notifications were not allowed") };
  }

  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await reg.update();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });
  const body = (await res.json()) as { error?: string };
  if (!res.ok) return { ok: false, message: body.error ?? tx(locale, "登録に失敗しました", "Registration failed") };
  return { ok: true, message: tx(locale, "プッシュ通知を有効にしました", "Push notifications enabled") };
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  }
}
