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

  return <ReleaseNotesGenerator slug={slug} />;
}
