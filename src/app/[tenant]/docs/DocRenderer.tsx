"use client";

import type { DocBlock } from "./blocks";

function Paragraph({ text }: { text: string }) {
  return <p className="text-[15px] leading-relaxed text-neutral-700 mb-4">{text}</p>;
}

function Heading({ level, text }: { level: 2 | 3; text: string }) {
  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (level === 2) {
    return (
      <h2 id={id} className="text-lg font-bold text-neutral-900 mt-8 mb-3 pb-2 border-b border-neutral-200 scroll-mt-24">
        {text}
      </h2>
    );
  }
  return (
    <h3 id={id} className="text-[15px] font-semibold text-neutral-900 mt-5 mb-2 scroll-mt-24">
      {text}
    </h3>
  );
}

function Steps({ items }: { items: Array<{ title: string; detail: string; tip?: string }> }) {
  return (
    <div className="my-5 space-y-0">
      {items.map((item, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center shrink-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shrink-0 z-10">
              {i + 1}
            </div>
            {i < items.length - 1 && <div className="w-px flex-1 bg-neutral-200 mt-1 mb-0 min-h-[20px]" />}
          </div>
          <div className="pb-5 pt-0.5 flex-1 min-w-0">
            <p className="font-semibold text-[15px] text-neutral-900 leading-snug mb-1">{item.title}</p>
            <p className="text-sm text-neutral-500 leading-relaxed">{item.detail}</p>
            {item.tip && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">
                <span>💡</span> {item.tip}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TipBox({ text, title }: { text: string; title?: string }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <span className="text-lg shrink-0 mt-0.5">💡</span>
      <div>
        {title && <p className="text-sm font-semibold text-emerald-800 mb-0.5">{title}</p>}
        <p className="text-sm text-emerald-800 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function WarningBox({ text, title }: { text: string; title?: string }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <span className="text-lg shrink-0 mt-0.5">⚠️</span>
      <div>
        {title && <p className="text-sm font-semibold text-amber-800 mb-0.5">{title}</p>}
        <p className="text-sm text-amber-800 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function InfoBox({ text, title }: { text: string; title?: string }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <span className="text-lg shrink-0 mt-0.5">ℹ️</span>
      <div>
        {title && <p className="text-sm font-semibold text-blue-800 mb-0.5">{title}</p>}
        <p className="text-sm text-blue-800 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function ExampleCard({ label, scenario, outcome }: { label: string; scenario: string; outcome?: string }) {
  return (
    <div className="my-4 rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden">
      <div className="px-4 py-2 border-b border-neutral-200 bg-neutral-100 flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-400">Example</span>
        <span className="text-xs text-neutral-700 font-medium">· {label}</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-neutral-700 leading-relaxed">{scenario}</p>
        {outcome && (
          <div className="flex gap-2 pt-1 border-t border-neutral-200">
            <span className="text-indigo-600 mt-0.5 shrink-0">→</span>
            <p className="text-sm text-neutral-500 leading-relaxed italic">{outcome}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ label, language, code }: { label?: string; language?: string; code: string }) {
  return (
    <div className="my-4 rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      {(label || language) && (
        <div className="px-4 py-1.5 border-b border-neutral-700 flex items-center justify-between">
          {label && <span className="text-xs text-neutral-300 font-medium">{label}</span>}
          {language && <span className="text-[10px] font-mono uppercase tracking-wide text-neutral-500">{language}</span>}
        </div>
      )}
      <pre className="px-4 py-3 overflow-x-auto text-[12.5px] leading-relaxed text-neutral-100 font-mono">{code}</pre>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-neutral-50">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide border-b border-neutral-200">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 1 ? "bg-neutral-50/60" : ""}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-neutral-700 border-b border-neutral-100 last:border-b-0 align-top font-mono text-[12.5px]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeatureGrid({ items, columns = 3 }: { items: Array<{ icon: string; name: string; desc: string; badge?: string }>; columns?: 2 | 3 }) {
  const cols = columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={`my-4 grid ${cols} gap-3`}>
      {items.map((item, i) => (
        <div key={i} className="relative rounded-xl border border-neutral-200 bg-white p-4 flex gap-3">
          <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-sm font-semibold text-neutral-900 leading-tight">{item.name}</p>
              {item.badge && (
                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full leading-none">
                  {item.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DocList({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const cls = "text-sm text-neutral-700 leading-relaxed";
  if (ordered) {
    return (
      <ol className="my-3 space-y-1.5 pl-5 list-decimal">
        {items.map((item, i) => (
          <li key={i} className={cls}>
            {item}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ul className="my-3 space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i} className={`${cls} flex gap-2 pl-0 list-none`}>
          <span className="text-indigo-600 mt-1.5 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const CALLOUT_STYLES = {
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", icon: "ℹ️" },
  success: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", icon: "✅" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", icon: "⚠️" },
  danger: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-800", icon: "🚨" },
};

function Callout({ variant, icon, title, text }: { variant: "info" | "success" | "warning" | "danger"; icon?: string; title: string; text: string }) {
  const s = CALLOUT_STYLES[variant];
  return (
    <div className={`my-4 rounded-xl border ${s.border} ${s.bg} p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">{icon || s.icon}</span>
        <div>
          <p className={`text-sm font-bold ${s.text} mb-1`}>{title}</p>
          <p className={`text-sm ${s.text} leading-relaxed`}>{text}</p>
        </div>
      </div>
    </div>
  );
}

function FieldList({ items }: { items: Array<{ field: string; type?: string; description: string; example?: string }> }) {
  return (
    <div className="my-4 space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-neutral-100 last:border-b-0">
          <div className="shrink-0 w-36">
            <code className="text-xs bg-neutral-100 text-neutral-700 px-2 py-1 rounded font-mono">{item.field}</code>
            {item.type && <p className="text-[10px] text-neutral-400 mt-1 ml-1">{item.type}</p>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-700 leading-relaxed">{item.description}</p>
            {item.example && <p className="text-xs text-neutral-400 mt-1 italic">e.g. {item.example}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Divider() {
  return <hr className="my-8 border-neutral-200" />;
}

export function DocRenderer({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return <Paragraph key={i} {...block} />;
          case "heading":
            return <Heading key={i} {...block} />;
          case "steps":
            return <Steps key={i} {...block} />;
          case "tip":
            return <TipBox key={i} {...block} />;
          case "warning":
            return <WarningBox key={i} {...block} />;
          case "info":
            return <InfoBox key={i} {...block} />;
          case "example":
            return <ExampleCard key={i} {...block} />;
          case "code":
            return <CodeBlock key={i} {...block} />;
          case "table":
            return <DataTable key={i} {...block} />;
          case "feature-grid":
            return <FeatureGrid key={i} {...block} />;
          case "list":
            return <DocList key={i} {...block} />;
          case "callout":
            return <Callout key={i} {...block} />;
          case "field-list":
            return <FieldList key={i} {...block} />;
          case "divider":
            return <Divider key={i} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
