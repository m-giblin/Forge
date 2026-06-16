"use client";

import ReactMarkdown from "react-markdown";

export default function MarkdownBlock({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
