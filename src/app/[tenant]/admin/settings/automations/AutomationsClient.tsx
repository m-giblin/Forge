"use client";

import { useState, useTransition } from "react";
import type { AutomationRule, TriggerType, Condition, ActionType, Action } from "@/lib/repositories/automationRules";
import { createAutomationAction, toggleAutomationAction, deleteAutomationAction } from "./actions";

const TRIGGER_LABELS: Record<TriggerType, string> = {
  "issue.created": "Issue created",
  "issue.status_changed": "Status changed",
  "issue.assigned": "Issue assigned",
  "comment.created": "Comment added",
};

const CONDITION_FIELDS = ["priority", "type", "status", "assignee_id", "labels"] as const;
const CONDITION_OPS = ["is", "is_not", "contains", "is_empty"] as const;
const ACTION_TYPES: ActionType[] = ["set_priority", "set_assignee", "add_label", "post_comment", "fire_webhook"];

const ACTION_LABELS: Record<ActionType, string> = {
  set_priority: "Set priority",
  set_assignee: "Set assignee",
  add_label: "Add label",
  post_comment: "Post comment",
  fire_webhook: "Fire webhook URL",
};

const emptyCondition = (): Condition => ({ field: "priority", operator: "is", value: "" });
const emptyAction = (): Action => ({ type: "set_priority", value: "" });

export default function AutomationsClient({ slug, rules }: { slug: string; rules: AutomationRule[] }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("issue.created");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([emptyAction()]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setName(""); setTrigger("issue.created"); setConditions([]); setActions([emptyAction()]); setError("");
    setShowForm(false);
  }

  function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (actions.length === 0) { setError("Add at least one action"); return; }
    startTransition(async () => {
      try {
        await createAutomationAction(slug, { name: name.trim(), trigger, conditions, actions });
        resetForm();
      } catch (e) {
        setError(String(e));
      }
    });
  }

  function updateCondition(i: number, patch: Partial<Condition>) {
    setConditions((cs) => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }

  function updateAction(i: number, patch: Partial<Action>) {
    setActions((as) => as.map((a, idx) => idx === i ? { ...a, ...patch } as Action : a));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Automation Rules</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Trigger actions automatically when issues change</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md"
        >
          + New rule
        </button>
      </div>

      {/* Existing rules */}
      {rules.length === 0 && !showForm && (
        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-700 rounded-lg">
          No automation rules yet. Create one to get started.
        </div>
      )}

      <div className="space-y-3">
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} slug={slug} />
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border border-zinc-700 rounded-lg p-5 bg-zinc-800/50 space-y-4">
          <h3 className="text-sm font-semibold text-white">New automation rule</h3>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Rule name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Auto-assign critical bugs"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Trigger</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as TriggerType)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white"
            >
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400">Conditions (all must match)</label>
              <button
                onClick={() => setConditions((cs) => [...cs, emptyCondition()])}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                + Add condition
              </button>
            </div>
            {conditions.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={c.field}
                  onChange={(e) => updateCondition(i, { field: e.target.value as Condition["field"] })}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                >
                  {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select
                  value={c.operator}
                  onChange={(e) => updateCondition(i, { operator: e.target.value as Condition["operator"] })}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                >
                  {CONDITION_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {c.operator !== "is_empty" && (
                  <input
                    value={c.value ?? ""}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                    placeholder="value"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                  />
                )}
                <button
                  onClick={() => setConditions((cs) => cs.filter((_, idx) => idx !== i))}
                  className="text-zinc-500 hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-400">Actions (run in order)</label>
              <button
                onClick={() => setActions((as) => [...as, emptyAction()])}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                + Add action
              </button>
            </div>
            {actions.map((a, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={a.type}
                  onChange={(e) => updateAction(i, { type: e.target.value as ActionType, value: "" })}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                >
                  {ACTION_TYPES.map((t) => <option key={t} value={t}>{ACTION_LABELS[t]}</option>)}
                </select>
                <input
                  value={a.value}
                  onChange={(e) => updateAction(i, { value: e.target.value })}
                  placeholder={a.type === "fire_webhook" ? "https://..." : a.type === "post_comment" ? "Comment text..." : "value"}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                />
                {actions.length > 1 && (
                  <button
                    onClick={() => setActions((as) => as.filter((_, idx) => idx !== i))}
                    className="text-zinc-500 hover:text-red-400 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md"
            >
              {isPending ? "Creating…" : "Create rule"}
            </button>
            <button onClick={resetForm} className="px-4 py-1.5 text-sm text-zinc-400 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleRow({ rule, slug }: { rule: AutomationRule; slug: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-4 p-4 bg-zinc-800/40 border border-zinc-700 rounded-lg">
      <input
        type="checkbox"
        checked={rule.enabled}
        onChange={(e) =>
          startTransition(() => toggleAutomationAction(slug, rule.id, e.target.checked))
        }
        className="mt-0.5 accent-indigo-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{rule.name}</span>
          {!rule.enabled && <span className="text-xs text-zinc-500 bg-zinc-700 px-1.5 py-0.5 rounded">disabled</span>}
        </div>
        <p className="text-xs text-zinc-400 mt-0.5">
          When <span className="text-indigo-300">{TRIGGER_LABELS[rule.trigger]}</span>
          {rule.conditions.length > 0 && (
            <> — if {rule.conditions.map((c) => `${c.field} ${c.operator}${c.value ? ` "${c.value}"` : ""}`).join(" AND ")}</>
          )}
          {" → "}{rule.actions.map((a) => `${ACTION_LABELS[a.type]}${a.value ? ` (${a.value.slice(0, 40)})` : ""}`).join(", ")}
        </p>
      </div>
      <button
        onClick={() => startTransition(() => deleteAutomationAction(slug, rule.id))}
        disabled={isPending}
        className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
