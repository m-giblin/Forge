import { notFound } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- public feedback page: no user JWT, service-role needed to find tenant + create ticket
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import FeedbackForm from "./FeedbackForm";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const svc = createSupabaseServiceClient();
  const { data: tenant } = await svc
    .from("tenants")
    .select("name")
    .eq("slug", slug)
    .single();

  if (!tenant) notFound();

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-3xl mb-2">💬</p>
          <h1 className="text-2xl font-bold text-neutral-900">Share your feedback</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Got a bug, idea, or question? Send it to <strong>{tenant.name}</strong>.
          </p>
        </div>
        <FeedbackForm slug={slug} tenantName={tenant.name} />
        <p className="mt-6 text-center text-xs text-neutral-400">
          Powered by <span className="font-medium text-neutral-500">Forge</span>
        </p>
      </div>
    </div>
  );
}
