export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[var(--arena-canvas)] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 h-4 w-28 animate-pulse rounded bg-arena-mist" />
        <div className="mb-3 h-10 w-48 animate-pulse rounded-lg bg-arena-mist" />
        <div className="mb-10 h-4 w-72 animate-pulse rounded bg-arena-mist" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-arena-line bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
