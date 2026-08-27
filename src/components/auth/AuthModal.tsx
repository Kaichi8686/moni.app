"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAuthCallbackUrl } from "@/lib/authRedirect";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Mode = "signin" | "signup";
type Step = "start" | "email";

type Props = {
  mode?: Mode;
  onClose: () => void;
  onAuthenticated: () => void;
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.47 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.63H1.28A12 12 0 0 0 0 12c0 1.94.46 3.78 1.28 5.37l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.63l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function AuthModal({ mode: initialMode = "signin", onClose, onAuthenticated }: Props) {
  const { tx } = useI18n();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragYRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const emailReady = email.trim().length > 0;
  const passwordReady =
    mode === "signup"
      ? password.length >= 8 && password === passwordConfirm
      : password.length > 0;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>("button, input");
      first?.focus();
    }, 40);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, step]);

  useEffect(() => {
    const node = handleRef.current;
    if (!node) return;
    const handleEl: HTMLDivElement = node;

    function onPointerDown(e: PointerEvent) {
      dragStartY.current = e.clientY;
      handleEl.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (dragStartY.current == null) return;
      const y = Math.max(0, e.clientY - dragStartY.current);
      dragYRef.current = y;
      setDragY(y);
    }
    function onPointerUp() {
      const shouldClose = dragYRef.current > 88;
      dragStartY.current = null;
      dragYRef.current = 0;
      setDragY(0);
      if (shouldClose) onClose();
    }

    handleEl.addEventListener("pointerdown", onPointerDown);
    handleEl.addEventListener("pointermove", onPointerMove);
    handleEl.addEventListener("pointerup", onPointerUp);
    handleEl.addEventListener("pointercancel", onPointerUp);
    return () => {
      handleEl.removeEventListener("pointerdown", onPointerDown);
      handleEl.removeEventListener("pointermove", onPointerMove);
      handleEl.removeEventListener("pointerup", onPointerUp);
      handleEl.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onClose]);

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

  async function signInWithMagicLink() {
    if (!supabase) return;
    const normalized = email.trim();
    if (!normalized) {
      setMessage(tx("メールアドレスを入力してください。", "Enter your email address."));
      return;
    }
    setLoading(true);
    const emailRedirectTo = getAuthCallbackUrl();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    setMessage(error ? error.message : tx("ログイン用リンクをメールに送信しました。受信箱・迷惑メールをご確認ください。", "We sent a login link. Check your inbox and spam folder."));
    setLoading(false);
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage(tx("メールアドレスを入力してください。", "Enter your email address."));
      return;
    }
    if (password.length < 8) {
      setMessage(tx("パスワードは8文字以上で入力してください。", "Password must be at least 8 characters."));
      return;
    }
    if (password !== passwordConfirm) {
      setMessage(tx("確認用パスワードが一致しません。", "Passwords do not match."));
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
      onAuthenticated();
    } else {
      setMessage(
        tx(
          "確認メールを送信しました。メール内のリンクを開いて登録を完了してください（届かない場合は迷惑メールフォルダも確認してください）。",
          "We sent a confirmation email. Open the link to finish signing up (check spam if you don't see it).",
        ),
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
      setMessage(tx("メールアドレスとパスワードを入力してください。", "Enter your email and password."));
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
    onAuthenticated();
    setLoading(false);
  }

  function goEmailStep(e: FormEvent) {
    e.preventDefault();
    if (!emailReady) {
      setMessage(tx("メールアドレスを入力してください。", "Enter your email address."));
      return;
    }
    setMessage("");
    setStep("email");
  }

  const continueClass = emailReady
    ? "auth-modal-continue is-ready"
    : "auth-modal-continue";

  return (
    <div className="auth-modal-root" role="presentation">
      <button type="button" className="auth-modal-overlay" aria-label={tx("閉じる", "Close")} onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="auth-modal-panel"
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          ref={handleRef}
          className="auth-modal-handle"
          aria-hidden
        >
          <span />
        </div>
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label={tx("閉じる", "Close")}>
          <X className="h-4 w-4" />
        </button>

        <div className="auth-modal-body">
          <header className="auth-modal-header">
            <h1 id={titleId} className="auth-modal-title">
              {step === "start"
                ? tx("ログインまたは新規登録", "Log in or sign up")
                : mode === "signup"
                  ? tx("アカウントを作成", "Create account")
                  : tx("ログイン", "Log in")}
            </h1>
            <p className="auth-modal-lead">
              {step === "start"
                ? tx(
                    "プロジェクトを進めたり、仲間とつながるにはアカウントが必要です。",
                    "Sign in to work on projects and connect with others.",
                  )
                : tx(`${email} で続行します。`, `Continue with ${email}.`)}
            </p>
          </header>

          {message ? <p className="auth-modal-message">{message}</p> : null}

          {step === "start" ? (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => void signInWithGoogle()}
                className="auth-modal-oauth"
              >
                <GoogleMark />
                {tx("Google で続ける", "Continue with Google")}
              </button>

              <div className="auth-modal-or" role="separator">
                <span>{tx("または", "or")}</span>
              </div>

              <form onSubmit={(e) => void goEmailStep(e)} className="flex flex-col gap-3">
                <label className="sr-only" htmlFor="auth-email">
                  {tx("メールアドレス", "Email address")}
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder={tx("メールアドレス", "Email address")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-modal-input"
                />
                <button type="submit" disabled={loading || !emailReady} className={continueClass}>
                  {tx("続行", "Continue")}
                </button>
              </form>
            </>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => void (mode === "signup" ? handleSignUp(e) : handleSignInPassword(e))}
            >
              <button
                type="button"
                className="auth-modal-back"
                onClick={() => {
                  setStep("start");
                  setMessage("");
                }}
              >
                {tx("← メールを変更", "← Change email")}
              </button>
              {mode === "signup" ? (
                <input
                  className="auth-modal-input"
                  autoComplete="nickname"
                  placeholder={tx("表示名（任意）", "Display name (optional)")}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              ) : null}
              <input
                type="password"
                className="auth-modal-input"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder={mode === "signup" ? tx("パスワード（8文字以上）", "Password (8+ characters)") : tx("パスワード", "Password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {mode === "signup" ? (
                <input
                  type="password"
                  className="auth-modal-input"
                  autoComplete="new-password"
                  placeholder={tx("パスワード確認", "Confirm password")}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />
              ) : null}
              <button
                type="submit"
                disabled={loading || !passwordReady}
                className={passwordReady ? "auth-modal-continue is-ready" : "auth-modal-continue"}
              >
                {loading ? tx("処理中…", "Please wait…") : mode === "signup" ? tx("登録して続ける", "Sign up") : tx("ログイン", "Log in")}
              </button>
              {mode === "signin" ? (
                <button
                  type="button"
                  disabled={loading}
                  className="auth-modal-text-btn"
                  onClick={() => void signInWithMagicLink()}
                >
                  {tx("パスワードなしでログインリンクを送る", "Email me a login link")}
                </button>
              ) : null}
            </form>
          )}

          <p className="auth-modal-switch">
            {mode === "signin" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
              >
                {tx("初めての方は新規登録", "Create an account")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setMessage("");
                }}
              >
                {tx("アカウントをお持ちの方はログイン", "Already have an account? Log in")}
              </button>
            )}
          </p>

          <p className="auth-modal-legal">
            {tx("登録により利用規約・プライバシーに同意したものとみなします。", "By continuing, you agree to the terms and privacy policy.")}
          </p>
        </div>
      </div>
    </div>
  );
}
