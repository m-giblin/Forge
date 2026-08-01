"use client";

import { useState } from "react";
import FormGrid from "@/components/patterns/admin/FormGrid";
import TogglesList from "@/components/patterns/admin/TogglesList";

export default function WidgetEmbed({ baseUrl, projectKey }: { baseUrl: string; projectKey: string }) {
  const [sessionReplay, setSessionReplay] = useState(false);
  const [copied, setCopied] = useState(false);

  const snippet = `<script src="${baseUrl}/forge-sdk.js"></script>
<script>
  ForgeSDK.init({
    apiKey: "fk_your_key_here",
    endpoint: "${baseUrl}/api/v1/issues",
    projectKey: "${projectKey}",
    environment: "production",
    // Optional: suppress noisy errors
    ignoreErrors: [/ResizeObserver/, /ChunkLoadError/],${sessionReplay ? `\n    sessionReplay: true, // buffers ~45s of masked DOM events, attached only when an issue is filed` : ""}
  });
</script>`;

  return (
    <div className="space-y-4">
      <FormGrid
        fields={[
          {
            key: "snippet",
            label: "Embed snippet",
            input: (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="absolute right-2 top-2 rounded-[5px] bg-[#2b2924] px-2.5 py-1 text-[11px] font-semibold text-[#f2e9d8] hover:bg-[#3a3730]"
                >
                  {copied ? "Copied" : "Copy snippet"}
                </button>
                <pre className="overflow-x-auto rounded-[6px] bg-[#20201d] p-4 text-[11px] leading-relaxed text-[#e8e4d8]">
                  <code>{snippet}</code>
                </pre>
              </div>
            ),
          },
        ]}
      />

      <div>
        <h3 className="mb-3 text-[12.5px] font-bold text-[#20201d]">Widget options</h3>
        <TogglesList
          items={[
            {
              key: "sessionReplay",
              label: "Session replay",
              description: "Buffer the last ~45s of masked DOM events; attached to an issue only when one is filed.",
              on: sessionReplay,
            },
          ]}
          onChange={(key, next) => { if (key === "sessionReplay") setSessionReplay(next); }}
        />
        <p className="mt-2 text-[11px] text-[#a19d90]">
          Console capture, screenshot, and require-email options aren&apos;t implemented in the SDK yet — only
          session replay is a real, wired option today.
        </p>
      </div>
    </div>
  );
}
