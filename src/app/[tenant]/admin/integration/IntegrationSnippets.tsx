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
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      {projects.length > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs font-medium text-neutral-500">Target project</label>
          <select
            value={selectedKey}
            onChange={(e) => { setSelectedKey(e.target.value); setCopied(false); }}
            className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {projects.map((p) => (
              <option key={p.key} value={p.key}>{p.key} — {p.name}</option>
            ))}
          </select>
          <span className="text-xs text-neutral-400">Snippet updates when you switch.</span>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-1">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => { setLang(l); setCopied(false); }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              lang === l ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="relative">
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); }}
          className="absolute right-2 top-2 rounded-md bg-neutral-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-700"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre className="overflow-x-auto rounded-lg bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-100">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
