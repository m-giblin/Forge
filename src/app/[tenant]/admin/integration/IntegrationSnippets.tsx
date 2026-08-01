"use client";

import { useState } from "react";

const LANGS = ["cURL", "Node / TypeScript", "Python", "C# / .NET"] as const;
type Lang = (typeof LANGS)[number];

function snippets(base: string, projectKey: string): Record<Lang, string> {
  const url = `${base}/api/v1/issues`;
  const pkLine = `    "projectKey": "${projectKey}",`;
  return {
    "cURL": `curl -X POST ${url} \\
  -H "Authorization: Bearer $FORGE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Checkout fails on Safari",
    "description": "Steps: ... Expected: ... Actual: ...",
${pkLine}
    "priority": "high",
    "type": "bug",
    "environment": "production"
  }'`,
    "Node / TypeScript": `// SERVER-SIDE ONLY — never expose FORGE_API_KEY to the browser.
// A "Report issue" button in your UI should call YOUR backend, which calls this.
export async function reportIssue(input: { title: string; description?: string }) {
  const res = await fetch("${url}", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.FORGE_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      projectKey: "${projectKey}",
      priority: "high",
      type: "bug",
      environment: "production",
    }),
  });
  if (!res.ok) throw new Error(\`Forge \${res.status}: \${await res.text()}\`);
  return (await res.json()).data; // { id, key: "${projectKey}-42", status, title }
}`,
    "Python": `import os, requests  # server-side only

def report_issue(title: str, description: str = ""):
    res = requests.post(
        "${url}",
        headers={
            "Authorization": f"Bearer {os.environ['FORGE_API_KEY']}",
            "Content-Type": "application/json",
        },
        json={
            "title": title,
            "description": description,
            "projectKey": "${projectKey}",
            "priority": "high",
            "type": "bug",
            "environment": "production",
        },
        timeout=10,
    )
    res.raise_for_status()
    return res.json()["data"]  # { id, key, status, title }`,
    "C# / .NET": `// server-side only
using System.Net.Http.Json;

using var http = new HttpClient();
http.DefaultRequestHeaders.Authorization =
    new("Bearer", Environment.GetEnvironmentVariable("FORGE_API_KEY"));

var payload = new {
    title = "Checkout fails on Safari",
    description = "Steps: ...",
    projectKey = "${projectKey}",
    priority = "high", type = "bug", environment = "production",
};
var res = await http.PostAsJsonAsync("${url}", payload);
res.EnsureSuccessStatusCode();
var body = await res.Content.ReadFromJsonAsync<JsonElement>();`,
  };
}

type Project = { key: string; name: string };

export default function IntegrationSnippets({
  baseUrl,
  projects,
}: {
  baseUrl: string;
  projects: Project[];
}) {
  const [lang, setLang] = useState<Lang>("Node / TypeScript");
  const [copied, setCopied] = useState(false);
  const [selectedKey, setSelectedKey] = useState(projects[0]?.key ?? "");
  const projectKey = selectedKey || projects[0]?.key || "GEN";
  const code = snippets(baseUrl, projectKey)[lang];

  return (
    <div className="fw-card px-4 py-4">
      {projects.length > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <label className="text-[11px] font-semibold text-[#726e60]">Target project</label>
          <select
            value={selectedKey}
            onChange={(e) => { setSelectedKey(e.target.value); setCopied(false); }}
            className="rounded-[5px] border border-[#ddd8c9] bg-white px-2 py-[5px] text-[12px] text-[#20201d] outline-none focus:border-[#b7452f]"
          >
            {projects.map((p) => (
              <option key={p.key} value={p.key}>{p.key} — {p.name}</option>
            ))}
          </select>
          <span className="text-[11px] text-[#a19d90]">Snippet updates when you switch.</span>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-1">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => { setLang(l); setCopied(false); }}
            className={`rounded-[5px] px-3 py-1.5 text-[12px] font-semibold transition ${
              lang === l ? "text-[#f2e9d8]" : "text-[#726e60] hover:bg-[#f4f2eb]"
            }`}
            style={lang === l ? { background: "linear-gradient(160deg,#9a5138,#6e3324)" } : undefined}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); }}
          className="absolute right-2 top-2 rounded-[5px] bg-[#2b2924] px-2.5 py-1 text-[11px] font-semibold text-[#f2e9d8] hover:bg-[#3a3730]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre className="overflow-x-auto rounded-[6px] bg-[#20201d] p-4 text-[11px] leading-relaxed text-[#e8e4d8]">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
