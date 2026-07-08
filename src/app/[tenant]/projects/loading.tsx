export default function ProjectsLoading() {
  return (
    <div className="w-full px-6 py-8 animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-32 rounded-lg bg-neutral-200" />
        <div className="h-9 w-32 rounded-xl bg-neutral-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
            <div className="mb-3 h-5 w-2/3 rounded bg-neutral-200" />
            <div className="mb-4 h-4 w-full rounded bg-neutral-100" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 rounded-full bg-neutral-200" />
              <div className="h-4 w-20 rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
