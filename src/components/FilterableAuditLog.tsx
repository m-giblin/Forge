"use client";

import { useState } from "react";
import AuditTable from "./AuditTable";

type AuditView = {
  id: string;
  tenant_id: string | null;
  action: string;
  target: string | null;
  actor: string | null;
  created_at: string;
};

type Filter = "all" | "ai" | "ideas" | "members" | "other";

const FILTER_OPTIONS: { value: Filter; label: string }[] = [
  { value: "all",     label: "All activity" },
  { value: "ai",      label: "AI turns" },
  { value: "ideas",   label: "Ideas" },
  { value: "members", label: "Members & keys" },
  { value: "other",   label: "Other" },
];

function matchesFilter(action: string, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "ai")      return action === "idea.ai_turn";
  if (filter === "ideas")   return action.startsWith("idea.") && action !== "idea.ai_turn";
  if (filter === "members") return action.startsWith("member.") || action.startsWith("api_key.") || action.startsWith("invite.");
  return !action.startsWith("idea.") && !action.startsWith("member.") && !action.startsWith("api_key.") && !action.startsWith("invite.");
}

interface Props {
  entries: AuditView[];
  dark?: boolean;
  showTenant?: boolean;
}

export default function FilterableAuditLog({ entries, dark = false, showTenant = false }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = entries.filter((e) => matchesFilter(e.action, filter));

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === opt.value
                ? "bg-neutral-900 text-white"
                : dark
                  ? "bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
            }`}
          >
            {opt.label}
            {filter === opt.value && entries.length > 0 && (
              <span className="ml-1.5 opacity-70">({filtered.length})</span>
            )}
          </button>
        ))}
      </div>
      <AuditTable entries={filtered} dark={dark} showTenant={showTenant} />
    </div>
  );
}
