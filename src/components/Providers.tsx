"use client";

import { LoginGate } from "@/components/auth/LoginGate";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { StaleAssetReload } from "@/components/StaleAssetReload";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <StaleAssetReload />
      <LoginGate>
        <OnboardingGate>{children}</OnboardingGate>
      </LoginGate>
    </I18nProvider>
  );
}
