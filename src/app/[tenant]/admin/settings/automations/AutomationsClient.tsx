"use client";

import { useState, useTransition } from "react";
import type { AutomationRule, TriggerType, Condition, ActionType, Action } from "@/lib/repositories/automationRules";
import { createAutomationAction, toggleAutomationAction, deleteAutomationAction } from "./actions";
import PageHeader from "@/components/patterns/PageHeader";
import RulesList from "@/components/patterns/admin/RulesList";
import FormGrid from "@/components/patterns/admin/FormGrid";

const TRIGGER_LABELS: Record<TriggerType, string> = {
  "issue.created": "Issue created",
  "issue.status_changed": "Status changed",
  "issue.assigned": "Issue assigned",
  "comment.created": "Comment added",
  "sprint.completed": "Sprint completed",
  "issue.idle": "Issue idle 5+ days",
};

const CONDITION_FIELDS = ["priority", "type", "status", "assignee_id", "labels"] as const;
const CONDITION_OPS = ["is", "is_not", "contains", "is_empty"] as const;
const ACTION_TYPES: ActionType[] = ["set_priority", "set_assignee", "add_label", "post_comment", "fire_webhook", "move_to_next_sprint"];

const ACTION_LABELS: Record<ActionType, string> = {
  set_priority: "Set priority",
  set_assignee: "Set assignee",
  add_label: "Add label",
  post_comment: "Post comment",
  fire_webhook: "Fire webhook URL",
  move_to_next_sprint: "Move to next sprint",
};

// Actions with no free-text parameter — the value input is meaningless for these.
const ACTION_NO_VALUE: Set<ActionType> = new Set(["move_to_next_sprint"]);

const INPUT =
  "w-full rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-1.5 text-[12.5px] text-[#20201d] placeholder-[#a19d90] focus:border-[#8c4632] focus:outline-none focus:ring-1 focus:ring-[#8c4632]";
const SELECT =
  "rounded-[5px] border border-[#ddd8c9] bg-white px-2.5 py-1.5 text-[12.5px] text-[#20201d] focus:border-[#8c4632] focus:outline-none focus:ring-1 focus:ring-[#8c4632]";

const emptyCondition = (): Condition => ({ field: "priority", operator: "is", value: "" });
const emptyAction = (): Action => ({ type: "set_priority", value: "" });

function conditionText(c: Condition) {
  return `${c.field} ${c.operator}${c.value ? ` "${c.value}"` : ""}`;
}

function actionText(a: Action) {
  return `${ACTION_LABELS[a.type]}${a.value ? ` (${a.value.slice(0, 40)})` : ""}`;
}

export default function AutomationsClient({ slug, rules }: { slug: string; rules: AutomationRule[] }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("issue.created");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([emptyAction()]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [, startRuleTransition] = useTransition();

  function resetForm() {
    setName("");
    setTrigger("issue.created");
    setConditions([]);
    setActions([emptyAction()]);
    setError("");
    setShowForm(false);
  }

  function handleCreate() {
    if (!name.trim()) {
      setError("Rule name is required.");
      return;
    }
    if (actions.length === 0) {
      setError("Add at least one action.");
      return;
    }
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
    setConditions((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function updateAction(i: number, patch: Partial<Action>) {
    setActions((as) => as.map((a, idx) => (idx === i ? ({ ...a, ...patch } as Action) : a)));
  }

  function handleToggle(key: string, next: boolean) {
    startRuleTransition(() => toggleAutomationAction(slug, key, next));
  }

  function handleDelete(key: string) {
    startRuleTransition(() => deleteAutomationAction(slug, key));
  }

  const ruleItems = rules.map((rule) => ({
    key: rule.id,
    name: rule.name + (rule.enabled ? "" : " (Disabled)"),
    condition:
      TRIGGER_LABELS[rule.trigger] +
      (rule.conditions.length > 0 ? ` — if ${rule.conditions.map(conditionText).join(" AND ")}` : ""),
    action: rule.actions.map(actionText).join(", "),
    on: rule.enabled,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        subtitle="Trigger actions automatically when issues change"
        right={
          !showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-[5px] border border-[#5e2c1f] px-3.5 py-[7px] text-[12px] font-semibold text-[#f2e9d8]"
              style={{ background: "linear-gradient(160deg,#9a5138,#6e3324)" }}
            >
              + New rule
            </button>
          ) : undefined
        }
      />

      <div className="space-y-6 px-6">
        {showForm && (
          <div className="space-y-3.5">
            {error && (
              <p className="rounded-[5px] border border-[#e0b3ab] bg-[#fbeceb] px-3 py-2 text-[12px] text-[#c0392b]">
                {error}
              </p>
            )}

            <FormGrid
              submitLabel={isPending ? "Creating…" : "Create rule"}
              onCancel={resetForm}
              onSubmit={handleCreate}
              fields={[
                {
                  key: "name",
                  label: "Rule name",
                  input: (
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Auto-assign critical bugs"
                      className={INPUT}
                    />
                  ),
                },
                {
                  key: "trigger",
                  label: "Trigger",
                  input: (
                    <select
                      value={trigger}
                      onChange={(e) => setTrigger(e.target.value as TriggerType)}
                      className={`${SELECT} w-full`}
                    >
                      {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ),
                },
                {
                  key: "conditions",
                  label: "Conditions (all must match)",
                  input: (
                    <div className="space-y-2">
                      {conditions.length === 0 && (
                        <p className="text-[11px] italic text-[#a19d90]">
                          No conditions — rule runs on every matching trigger.
                        </p>
                      )}
                      {conditions.map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            value={c.field}
                            onChange={(e) => updateCondition(i, { field: e.target.value as Condition["field"] })}
                            className={SELECT}
                          >
                            {CONDITION_FIELDS.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                          <select
                            value={c.operator}
                            onChange={(e) => updateCondition(i, { operator: e.target.value as Condition["operator"] })}
                            className={SELECT}
                          >
                            {CONDITION_OPS.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                          {c.operator !== "is_empty" && (
                            <input
                              value={c.value ?? ""}
                              onChange={(e) => updateCondition(i, { value: e.target.value })}
                              placeholder="value"
                              className={`flex-1 ${INPUT}`}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setConditions((cs) => cs.filter((_, idx) => idx !== i))}
                            className="shrink-0 text-[13px] leading-none text-[#a19d90] hover:text-[#c0392b]"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setConditions((cs) => [...cs, emptyCondition()])}
                        className="text-[11.5px] font-semibold text-[#b7452f] hover:underline"
                      >
                        + Add condition
                      </button>
                    </div>
                  ),
                },
                {
                  key: "actions",
                  label: "Actions (run in order)",
                  input: (
                    <div className="space-y-2">
                      {actions.map((a, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            value={a.type}
                            onChange={(e) => updateAction(i, { type: e.target.value as ActionType, value: "" })}
                            className={SELECT}
                          >
                            {ACTION_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {ACTION_LABELS[t]}
                              </option>
                            ))}
                          </select>
                          {!ACTION_NO_VALUE.has(a.type) && (
                            <input
                              value={a.value}
                              onChange={(e) => updateAction(i, { value: e.target.value })}
                              placeholder={
                                a.type === "fire_webhook"
                                  ? "https://hooks.example.com/..."
                                  : a.type === "post_comment"
                                    ? "Comment text…"
                                    : a.type === "add_label"
                                      ? "bug, urgent, …"
                                      : "value"
                              }
                              className={`flex-1 ${INPUT}`}
                            />
                          )}
                          {actions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setActions((as) => as.filter((_, idx) => idx !== i))}
                              className="shrink-0 text-[13px] leading-none text-[#a19d90] hover:text-[#c0392b]"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setActions((as) => [...as, emptyAction()])}
                        className="text-[11.5px] font-semibold text-[#b7452f] hover:underline"
                      >
                        + Add action
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}

        {rules.length === 0 && !showForm && (
          <div className="fw-card border-dashed py-12 text-center">
            <p className="text-[12.5px] text-[#726e60]">No automation rules yet.</p>
            <p className="mt-1 text-[11px] text-[#a19d90]">
              Create a rule to automatically act when issues change.
            </p>
          </div>
        )}

        {rules.length > 0 && (
          <RulesList items={ruleItems} onToggle={handleToggle} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
