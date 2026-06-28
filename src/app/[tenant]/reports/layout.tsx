import type { ReactNode } from "react";
import ReportsSubNav from "./ReportsSubNav";

export default async function ReportsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  return (
    <div className="flex min-h-0 flex-1 w-full overflow-hidden">
      <ReportsSubNav slug={slug} />
      <div className="flex-1 min-w-0 overflow-auto">
        {children}
      </div>
    </div>
  );
}
