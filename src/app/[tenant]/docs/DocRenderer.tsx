"use client";

import type { DocBlock } from "./blocks";

function Paragraph({ text }: { text: string }) {
  return <p className="text-[15px] leading-relaxed text-[#4a473e] mb-4">{text}</p>;
}

function Heading({ level, text }: { level: 2 | 3; text: string }) {
  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (level === 2) {
    return (
      <h2 id={id} className="text-lg font-bold text-[#20201d] mt-8 mb-3 pb-2 border-b border-[#ddd8c9] scroll-mt-24">
        {text}
      </h2>
    );
  }
  return (
    <h3 id={id} className="text-[15px] font-semibold text-[#20201d] mt-5 mb-2 scroll-mt-24">
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
            <div className="w-8 h-8 rounded-full bg-[#b7452f] text-white flex items-center justify-center text-sm font-bold shrink-0 z-10">
              {i + 1}
            </div>
            {i < items.length - 1 && <div className="w-px flex-1 bg-neutral-200 mt-1 mb-0 min-h-[20px]" />}
          </div>
          <div className="pb-5 pt-0.5 flex-1 min-w-0">
            <p className="font-semibold text-[15px] text-[#20201d] leading-snug mb-1">{item.title}</p>
            <p className="text-sm text-[#726e60] leading-relaxed">{item.detail}</p>
            {item.tip && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs bg-[#e9f3ea] text-[#3f7d4c] border border-[#3f7d4c]/30 rounded-full px-2.5 py-1">
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
    <div className="my-4 flex gap-3 rounded-xl border border-[#3f7d4c]/30 bg-[#e9f3ea] p-4">
      <span className="text-lg shrink-0 mt-0.5">💡</span>
      <div>
        {title && <p className="text-sm font-semibold text-[#3f7d4c] mb-0.5">{title}</p>}
        <p className="text-sm text-[#3f7d4c] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function WarningBox({ text, title }: { text: string; title?: string }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl border border-[#c9791d]/30 bg-[#fdf1de] p-4">
      <span className="text-lg shrink-0 mt-0.5">⚠️</span>
      <div>
        {title && <p className="text-sm font-semibold text-[#c9791d] mb-0.5">{title}</p>}
        <p className="text-sm text-[#c9791d] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function InfoBox({ text, title }: { text: string; title?: string }) {
  return (
    <div className="my-4 flex gap-3 rounded-xl border border-[#3a6ea8]/30 bg-[#eaf1f8] p-4">
      <span className="text-lg shrink-0 mt-0.5">ℹ️</span>
      <div>
        {title && <p className="text-sm font-semibold text-[#3a6ea8] mb-0.5">{title}</p>}
        <p className="text-sm text-[#3a6ea8] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function ExampleCard({ label, scenario, outcome }: { label: string; scenario: string; outcome?: string }) {
  return (
    <div className="my-4 rounded-xl border border-[#ddd8c9] bg-[#f4f2eb] overflow-hidden">
      <div className="px-4 py-2 border-b border-[#ddd8c9] bg-[#f1efe9] flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-widest uppercase text-[#a19d90]">Example</span>
        <span className="text-xs text-[#4a473e] font-medium">· {label}</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-[#4a473e] leading-relaxed">{scenario}</p>
        {outcome && (
          <div className="flex gap-2 pt-1 border-t border-[#ddd8c9]">
            <span className="text-[#b7452f] mt-0.5 shrink-0">→</span>
            <p className="text-sm text-[#726e60] leading-relaxed italic">{outcome}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ label, language, code }: { label?: string; language?: string; code: string }) {
  return (
    <div className="my-4 rounded-xl border border-[#5e2c1f] bg-[#20201d] overflow-hidden">
      {(label || language) && (
        <div className="px-4 py-1.5 border-b border-[#4a473e] flex items-center justify-between">
          {label && <span className="text-xs text-[#a19d90] font-medium">{label}</span>}
          {language && <span className="text-[10px] font-mono uppercase tracking-wide text-[#726e60]">{language}</span>}
        </div>
      )}
      <pre className="px-4 py-3 overflow-x-auto text-[12.5px] leading-relaxed text-[#f2e9d8] font-mono">{code}</pre>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-[#ddd8c9]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#f4f2eb]">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold text-[#726e60] uppercase tracking-wide border-b border-[#ddd8c9]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 1 ? "bg-[#f4f2eb]/60" : ""}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-[#4a473e] border-b border-[#ddd8c9] last:border-b-0 align-top font-mono text-[12.5px]">
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
        <div key={i} className="relative rounded-xl border border-[#ddd8c9] bg-[#faf8f2] p-4 flex gap-3">
          <span className="text-2xl shrink-0 mt-0.5">{item.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-sm font-semibold text-[#20201d] leading-tight">{item.name}</p>
              {item.badge && (
                <span className="text-[9px] font-bold bg-[#fdf1de] text-[#c9791d] border border-[#c9791d]/30 px-1.5 py-0.5 rounded-full leading-none">
                  {item.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-[#726e60] leading-relaxed">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DocList({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const cls = "text-sm text-[#4a473e] leading-relaxed";
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
          <span className="text-[#b7452f] mt-1.5 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const CALLOUT_STYLES = {
  info: { bg: "bg-[#eaf1f8]", border: "border-[#3a6ea8]/30", text: "text-[#3a6ea8]", icon: "ℹ️" },
  success: { bg: "bg-[#e9f3ea]", border: "border-[#3f7d4c]/30", text: "text-[#3f7d4c]", icon: "✅" },
  warning: { bg: "bg-[#fdf1de]", border: "border-[#c9791d]/30", text: "text-[#c9791d]", icon: "⚠️" },
  danger: { bg: "bg-[#fbeae8]", border: "border-[#c0392b]/30", text: "text-[#c0392b]", icon: "🚨" },
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
        <div key={i} className="flex gap-4 py-3 border-b border-[#ddd8c9] last:border-b-0">
          <div className="shrink-0 w-36">
            <code className="text-xs bg-[#f1efe9] text-[#4a473e] px-2 py-1 rounded font-mono">{item.field}</code>
            {item.type && <p className="text-[10px] text-[#a19d90] mt-1 ml-1">{item.type}</p>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#4a473e] leading-relaxed">{item.description}</p>
            {item.example && <p className="text-xs text-[#a19d90] mt-1 italic">e.g. {item.example}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Divider() {
  return <hr className="my-8 border-[#ddd8c9]" />;
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
