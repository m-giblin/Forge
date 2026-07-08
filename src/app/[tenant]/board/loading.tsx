export default function BoardLoading() {
  const cols = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
  return (
    <div className="flex h-full gap-3 overflow-x-auto px-6 py-6 animate-pulse">
      {cols.map((col) => (
        <div key={col} className="flex w-72 shrink-0 flex-col gap-2">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-4 w-24 rounded bg-neutral-200" />
            <div className="h-4 w-6 rounded-full bg-neutral-200" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-neutral-100 bg-white p-3 shadow-sm">
              <div className="mb-2 h-4 w-full rounded bg-neutral-200" />
              <div className="h-3 w-2/3 rounded bg-neutral-100" />
              <div className="mt-3 flex items-center justify-between">
                <div className="h-5 w-16 rounded-full bg-neutral-100" />
                <div className="h-6 w-6 rounded-full bg-neutral-200" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
