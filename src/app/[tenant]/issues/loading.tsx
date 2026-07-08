export default function IssuesLoading() {
  return (
    <div className="w-full px-6 py-8 animate-pulse">
      <div className="mb-6 flex items-center gap-4">
        <div className="h-8 w-48 rounded-lg bg-neutral-200" />
        <div className="h-8 w-24 rounded-lg bg-neutral-200" />
      </div>
      <div className="mb-4 flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-neutral-200" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-white px-4 py-3">
            <div className="h-4 w-4 rounded bg-neutral-200" />
            <div className="h-4 w-16 rounded bg-neutral-200" />
            <div className="h-4 flex-1 rounded bg-neutral-200" />
            <div className="h-5 w-20 rounded-full bg-neutral-200" />
            <div className="h-6 w-6 rounded-full bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
