"use client";

import { SignupOnboardingWizard } from "@/components/onboarding/SignupOnboardingWizard";
import type { Session } from "@supabase/supabase-js";

/** Local UI preview for signup onboarding (no real auth required for viewing steps). */
const previewSession = {
  access_token: "preview",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "preview",
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "preview@example.com",
    app_metadata: {},
    user_metadata: { display_name: "" },
    created_at: new Date().toISOString(),
  },
} as unknown as Session;

export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-zinc-100 px-4 text-center text-sm text-zinc-600">
        Preview is available in development only.
      </main>
    );
  }

  return (
    <SignupOnboardingWizard
      session={previewSession}
      initialNickname=""
      onComplete={() => {
        window.alert("オンボーディング完了（プレビュー）");
      }}
    />
  );
}
