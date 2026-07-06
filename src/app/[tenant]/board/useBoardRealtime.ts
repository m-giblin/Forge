"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { type Issue } from "@/lib/repositories/issues";

type Member = { userId: string; label: string };
type PresentUser = { userId: string; label: string };

export function useBoardRealtime({
  tenantId,
  projectId,
  meUserId,
  members,
  onUpsert,
  onRemove,
}: {
  tenantId: string;
  projectId: string;
  meUserId?: string;
  members: Member[];
  onUpsert: (issue: Issue) => void;
  onRemove: (id: string) => void;
}): { presentUsers: PresentUser[] } {
  const [presentUsers, setPresentUsers] = useState<PresentUser[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      const meLabel = meUserId
        ? (members.find((m) => m.userId === meUserId)?.label ?? "You")
        : "You";

      channel = supabase
        .channel(`board:${tenantId}:${projectId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "issues", filter: `tenant_id=eq.${tenantId}` },
          (payload) => {
            if (payload.eventType === "DELETE") onRemove((payload.old as { id: string }).id);
            else {
              const row = payload.new as Issue;
              if (row.project_id === projectId) onUpsert(row);
            }
          }
        )
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<{ userId: string; label: string }>();
          const others = Object.values(state)
            .flat()
            .filter((p) => p.userId !== meUserId)
            .reduce<PresentUser[]>((acc, p) => {
              if (!acc.find((x) => x.userId === p.userId)) acc.push({ userId: p.userId, label: p.label });
              return acc;
            }, []);
          setPresentUsers(others);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && meUserId) {
            await channel!.track({ userId: meUserId, label: meLabel });
          }
        });
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [tenantId, projectId]);

  return { presentUsers };
}
