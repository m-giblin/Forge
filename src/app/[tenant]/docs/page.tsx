import { redirect } from 'next/navigation';
import { getTenantContext } from '@/lib/auth';
import { DocsHub } from './DocsHub';

export default async function DocsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const ctx = await getTenantContext(tenant);
  if (!ctx) redirect('/');
  if (!['owner', 'admin', 'member', 'viewer'].includes(ctx.role)) redirect(`/${tenant}/board`);

  return (
    <DocsHub
      role={ctx.role}
      tenantName={ctx.tenant.name}
      slug={tenant}
    />
  );
}
