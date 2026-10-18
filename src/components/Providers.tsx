"use client";

import { PwaInstallHint } from "@/components/PwaInstallHint";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      {children}
      <PwaInstallHint />
    </I18nProvider>
  );
}
