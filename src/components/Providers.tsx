"use client";

import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <OnboardingGate>{children}</OnboardingGate>
    </I18nProvider>
  );
}
