"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOrCreateProjectConversation } from "@/lib/messages/api";
import { isValidProjectUuid, normalizeProjectIdParam } from "@/lib/projects/validateProjectId";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** プロジェクト内チャット → メールタブのプロジェクトグループラインへ誘導 */
export default function ProjectChatRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const { tx } = useI18n();
  const [message, setMessage] = useState(tx("メールを開いています…", "Opening mail…"));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const raw = typeof params.projectId === "string" ? params.projectId : "";
      const projectId = normalizeProjectIdParam(raw);
      if (!isValidProjectUuid(projectId) || !supabase) {
        setMessage(tx("プロジェクトが見つかりません", "Project not found"));
        return;
      }
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        router.replace(`/login?next=/projects/${projectId}/chat`);
        return;
      }
      const convId = await getOrCreateProjectConversation(supabase, projectId);
      if (cancelled) return;
      if (convId) {
        router.replace(`/messages/${convId}`);
        return;
      }
      setMessage(
        tx(
          "グループラインを開けませんでした。メールタブからもう一度試してください。",
          "Could not open the group line. Try again from the Mail tab.",
        ),
      );
      window.setTimeout(() => {
        if (!cancelled) router.replace("/messages");
      }, 1600);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.projectId, router, tx]);

  return (
    <div className="flex min-h-[50vh] flex-1 items-center justify-center px-4">
      <p className="text-center text-sm text-zinc-500">{message}</p>
    </div>
  );
}
