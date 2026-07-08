export default function AdminLoading() {
  return (
    <div className="w-full px-8 py-8 animate-pulse">
      <div className="mb-6 h-7 w-48 rounded-lg bg-neutral-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
            <div className="mb-2 h-5 w-1/2 rounded bg-neutral-200" />
            <div className="h-4 w-full rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
