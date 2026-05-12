"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "@/lib/supabase";
import { getAuthCallbackUrl } from "@/lib/authRedirect";

const inputClass =
  "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-500 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 sm:text-sm";
const primaryBtn =
  "min-h-[44px] w-full rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45";
const secondaryBtn =
  "min-h-[44px] w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-45";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mode = new URLSearchParams(window.location.search).get("mode");
      if (mode === "signin") setTab("signin");
    }
  }, []);

  useEffect(() => {
    if (!supabase || !supabaseEnabled) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function signInWithGoogle() {
    if (!supabase) return;
    setLoading(true);
    const redirectTo = getAuthCallbackUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) setMessage(error.message);
    setLoading(false);
  }

  async function signInWithMagicLink(e?: FormEvent) {
    e?.preventDefault();
    if (!supabase) return;
    const normalized = email.trim();
    if (!normalized) {
      setMessage("メールアドレスを入力してください。");
      return;
    }
    setLoading(true);
    const emailRedirectTo = getAuthCallbackUrl();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    setMessage(error ? error.message : "ログイン用リンクをメールに送信しました。受信箱・迷惑メールをご確認ください。");
    setLoading(false);
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("メールアドレスを入力してください。");
      return;
    }
    if (password.length < 8) {
      setMessage("パスワードは8文字以上で入力してください。");
      return;
    }
    if (password !== passwordConfirm) {
      setMessage("確認用パスワードが一致しません。");
      return;
    }
    setLoading(true);
    const emailRedirectTo = getAuthCallbackUrl();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
        data: {
          display_name: displayName.trim() || normalizedEmail.split("@")[0] || "user",
        },
      },
    });
    if (error) {
      setMessage(error.message);
    } else if (data.session) {
      setMessage("登録が完了しました。ホームへ移動します。");
      router.replace("/");
    } else {
      setMessage(
        "確認メールを送信しました。メール内のリンクを開いて登録を完了してください（届かない場合は迷惑メールフォルダも確認してください）。",
      );
      setPassword("");
      setPasswordConfirm("");
    }
    setLoading(false);
  }

  async function handleSignInPassword(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setMessage("メールアドレスとパスワードを入力してください。");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    router.replace("/");
    setLoading(false);
  }

  if (!supabaseEnabled || !supabase) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-4 py-10">
        <p className="text-sm text-rose-700">
          Supabase が未設定です。`.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定してください。
        </p>
        <Link href="/" className="text-sm font-semibold text-sky-700 hover:underline">
          ホームへ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] bg-gradient-to-b from-zinc-50 to-zinc-100 px-4 py-10 text-zinc-900">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="text-center">
          <Link href="/" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
            ← moni ホームへ戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">ログイン / 新規登録</h1>
          <p className="mt-2 text-sm text-zinc-600">メール・パスワード、または Google で続行できます。</p>
        </header>

        {message ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{message}</p>
        ) : null}

        <div className="flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              tab === "signup" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
            }`}
            onClick={() => {
              setTab("signup");
              setMessage("");
            }}
          >
            新規登録
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              tab === "signin" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
            }`}
            onClick={() => {
              setTab("signin");
              setMessage("");
            }}
          >
            ログイン
          </button>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void signInWithGoogle()}
          className={primaryBtn}
        >
          Google で続ける
        </button>

        <div className="relative py-2 text-center text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          <span className="relative z-10 bg-gradient-to-b from-zinc-50 to-zinc-100 px-2">またはメール</span>
          <span className="absolute inset-x-0 top-1/2 z-0 h-px bg-zinc-200" aria-hidden />
        </div>

        {tab === "signup" ? (
          <form className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm" onSubmit={(e) => void handleSignUp(e)}>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-700">表示名（任意）</span>
              <input
                className={`mt-1 ${inputClass}`}
                autoComplete="nickname"
                placeholder="ニックネーム"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-700">メール</span>
              <input
                type="email"
                required
                className={`mt-1 ${inputClass}`}
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-700">パスワード（8文字以上）</span>
              <input
                type="password"
                required
                className={`mt-1 ${inputClass}`}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-700">パスワード確認</span>
              <input
                type="password"
                required
                className={`mt-1 ${inputClass}`}
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </label>
            <button type="submit" disabled={loading} className={primaryBtn}>
              メールアドレスで登録
            </button>
          </form>
        ) : (
          <form className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm" onSubmit={(e) => void handleSignInPassword(e)}>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-700">メール</span>
              <input
                type="email"
                required
                className={`mt-1 ${inputClass}`}
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-zinc-700">パスワード</span>
              <input
                type="password"
                required
                className={`mt-1 ${inputClass}`}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button type="submit" disabled={loading} className={primaryBtn}>
              ログイン
            </button>
            <button type="button" disabled={loading} className={secondaryBtn} onClick={() => void signInWithMagicLink()}>
              パスワードなしでログインリンクを送る
            </button>
          </form>
        )}

        <p className="text-center text-[11px] leading-relaxed text-zinc-500">
          登録により利用規約・プライバシーに同意したものとみなします。メールが届かない場合は Supabase の Auth 設定と Redirect URLs（本番は{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 text-[10px]">/auth/callback</code>
          ）を確認してください。
        </p>
      </div>
    </main>
  );
}
