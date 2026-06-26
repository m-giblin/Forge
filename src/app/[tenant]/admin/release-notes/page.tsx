import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import ReleaseNotesGenerator from "./ReleaseNotesGenerator";

export default async function ReleaseNotesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await getTenantContext(slug);
  if (!ctx) redirect("/");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">AI Release Notes</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Select a date range, pick projects, and let Grok draft structured release notes from your done issues.
        </p>
      </div>
      <ReleaseNotesGenerator slug={slug} />
    </div>
  );
}
