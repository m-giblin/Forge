"use server";

/**
 * Dogfood: file a bug by calling Forge's OWN public API over HTTP — the exact
 * path a customer's app uses. Auth uses FORGE_SELF_API_KEY (a raw key you mint
 * on the API keys page and put in .env.local), because we store only key hashes
 * and can't recover one server-side. The key's tenant determines where it lands.
 *
 * Uses NEXT_PUBLIC_APP_URL for the base URL so the self-call always routes to
 * localhost regardless of what IP external clients are connecting from.
 */
export async function reportBugAction(input: { title: string; description?: string; priority?: string }): Promise<{ id: string; key: string }> {
  const apiKey = process.env.FORGE_SELF_API_KEY;
  if (!apiKey) {
    throw new Error("FORGE_SELF_API_KEY is not set. Mint a key on the API keys page and add it to .env.local.");
  }
  if (!input.title.trim()) throw new Error("Title is required.");

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");

  const res = await fetch(`${baseUrl}/api/v1/issues`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      type: "bug",
      priority: input.priority ?? "medium",
      environment: "forge-dogfood",
    }),
  });
  if (!res.ok) throw new Error(`Forge API ${res.status}: ${await res.text()}`);
  const data = (await res.json()).data;
  return { id: data.id, key: data.key };
}

export async function attachFilesToBugAction(issueId: string, files: FormData): Promise<void> {
  const apiKey = process.env.FORGE_SELF_API_KEY;
  if (!apiKey) return;
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
  for (const [, value] of files.entries()) {
    if (!(value instanceof File) || value.size === 0) continue;
    const form = new FormData();
    form.append("file", value);
    await fetch(`${baseUrl}/api/v1/issues/${issueId}/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    }).catch(() => null); // best-effort
  }
}
