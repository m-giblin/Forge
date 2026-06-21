import { getTenantContext } from '@/lib/auth';
import { DocsHub } from './DocsHub';

export default async function DocsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const ctx = await getTenantContext(tenant);

  return (
    <DocsHub
      role={ctx?.role ?? 'viewer'}
      tenantName={ctx?.tenant.name ?? tenant}
      slug={tenant}
    />
  );
}
