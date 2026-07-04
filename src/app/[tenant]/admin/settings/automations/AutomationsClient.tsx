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

const INPUT = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const SELECT = "rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

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
    if (!name.trim()) { setError("Rule name is required."); return; }
    if (actions.length === 0) { setError("Add at least one action."); return; }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">Trigger actions automatically when issues change</p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            + New rule
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-semibold text-neutral-900">New automation rule</h3>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {/* Name */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-600">Rule name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Auto-assign critical bugs"
              className={INPUT}
            />
          </div>

          {/* Trigger */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-600">Trigger</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as TriggerType)}
              className={`${SELECT} w-full`}
            >
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-600">Conditions <span className="font-normal text-neutral-400">(all must match)</span></label>
              <button
                onClick={() => setConditions((cs) => [...cs, emptyCondition()])}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              >
                + Add condition
              </button>
            </div>
            {conditions.length === 0 && (
              <p className="text-xs text-neutral-400 italic">No conditions — rule runs on every matching trigger.</p>
            )}
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={c.field}
                  onChange={(e) => updateCondition(i, { field: e.target.value as Condition["field"] })}
                  className={SELECT}
                >
                  {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select
                  value={c.operator}
                  onChange={(e) => updateCondition(i, { operator: e.target.value as Condition["operator"] })}
                  className={SELECT}
                >
                  {CONDITION_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {c.operator !== "is_empty" && (
                  <input
                    value={c.value ?? ""}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                    placeholder="value"
                    className="flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
                <button
                  onClick={() => setConditions((cs) => cs.filter((_, idx) => idx !== i))}
                  className="text-neutral-400 hover:text-red-500 text-sm leading-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-600">Actions <span className="font-normal text-neutral-400">(run in order)</span></label>
              <button
                onClick={() => setActions((as) => [...as, emptyAction()])}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              >
                + Add action
              </button>
            </div>
            {actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={a.type}
                  onChange={(e) => updateAction(i, { type: e.target.value as ActionType, value: "" })}
                  className={SELECT}
                >
                  {ACTION_TYPES.map((t) => <option key={t} value={t}>{ACTION_LABELS[t]}</option>)}
                </select>
                <input
                  value={a.value}
                  onChange={(e) => updateAction(i, { value: e.target.value })}
                  placeholder={
                    a.type === "fire_webhook" ? "https://hooks.example.com/..."
                    : a.type === "post_comment" ? "Comment text…"
                    : a.type === "add_label" ? "bug, urgent, …"
                    : "value"
                  }
                  className="flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-indigo-500 focus:outline-none"
                />
                {actions.length > 1 && (
                  <button
                    onClick={() => setActions((as) => as.filter((_, idx) => idx !== i))}
                    className="text-neutral-400 hover:text-red-500 text-sm leading-none"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t border-neutral-100 pt-4">
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {isPending ? "Creating…" : "Create rule"}
            </button>
            <button
              onClick={resetForm}
              className="text-sm text-neutral-500 hover:text-neutral-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rule list */}
      {rules.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-neutral-200 py-12 text-center">
          <p className="text-sm text-neutral-500">No automation rules yet.</p>
          <p className="mt-1 text-xs text-neutral-400">Create a rule to automatically act when issues change.</p>
        </div>
      )}

      <div className="space-y-3">
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} slug={slug} />
        ))}
      </div>
    </div>
  );
}

function RuleRow({ rule, slug }: { rule: AutomationRule; slug: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <input
        type="checkbox"
        checked={rule.enabled}
        onChange={(e) =>
          startTransition(() => toggleAutomationAction(slug, rule.id, e.target.checked))
        }
        className="mt-0.5 h-4 w-4 accent-indigo-600 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900">{rule.name}</span>
          {!rule.enabled && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
              Disabled
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">
          When <span className="font-medium text-indigo-600">{TRIGGER_LABELS[rule.trigger]}</span>
          {rule.conditions.length > 0 && (
            <> — if {rule.conditions.map((c) => `${c.field} ${c.operator}${c.value ? ` "${c.value}"` : ""}`).join(" AND ")}</>
          )}
          {" → "}
          {rule.actions.map((a) => `${ACTION_LABELS[a.type]}${a.value ? ` (${a.value.slice(0, 40)})` : ""}`).join(", ")}
        </p>
      </div>
      <button
        onClick={() => startTransition(() => deleteAutomationAction(slug, rule.id))}
        disabled={isPending}
        className="text-xs text-neutral-400 hover:text-red-500 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
