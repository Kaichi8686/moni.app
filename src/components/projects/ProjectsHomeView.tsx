"use client";

import { useEffect, useState } from "react";
import { ProjectTabGlide } from "@/components/projects/ProjectTabGlide";
import { supabase } from "@/lib/supabase";

export function ProjectsHomeView() {
  const [displayName, setDisplayName] = useState("moni");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    void client.auth.getSession().then(({ data }) => {
      const session = data.session ?? null;
      setHasSession(Boolean(session));
      setSessionEmail(session?.user.email ?? null);
      if (session?.user.id) {
        void client
          .from("profiles")
          .select("display_name")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data: p }) => {
            const name = ((p as { display_name?: string | null } | null)?.display_name ?? "").trim();
            if (name) setDisplayName(name);
          });
      }
    });
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl p-3 sm:p-4">
      <ProjectTabGlide
        displayName={displayName}
        sessionEmail={sessionEmail}
        hasSession={hasSession}
        onNavigate={() => {
          // projects routeでは遷移不要（メインアプリ側で使用するためのprops）
        }}
      />
    </main>
  );
}
