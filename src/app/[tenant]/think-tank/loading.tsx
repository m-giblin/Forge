export default function ThinkTankLoading() {
  return (
    <div className="w-full px-6 py-8 animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-8 w-36 rounded-lg bg-neutral-200" />
        <div className="h-9 w-28 rounded-xl bg-neutral-200" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <div className="h-5 w-20 rounded-full bg-neutral-200" />
              <div className="h-5 flex-1 rounded bg-neutral-200" />
            </div>
            <div className="h-4 w-3/4 rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
