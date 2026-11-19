type SkeletonProps = {
  className?: string;
};

/** Pulsing placeholder block. Keep layouts close to the real UI. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200/80 ${className}`}
      aria-hidden
    />
  );
}

type CountProps = {
  count?: number;
  className?: string;
};

/** Message inbox rows (avatar + title + preview). */
export function InboxListSkeleton({ count = 8, className = "" }: CountProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={className}
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center px-4 py-3">
          <Skeleton className="mr-3 h-14 w-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-10 shrink-0" />
            </div>
            <Skeleton className="h-3 w-48 max-w-[75%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Chat thread while conversation header/messages load. */
export function ConversationSkeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={`flex h-full min-h-0 flex-1 flex-col bg-[#fafaf8] ${className}`}
    >
      <span className="sr-only">Loading…</span>
      <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3 px-4 py-6">
        <div className="flex justify-start">
          <Skeleton className="h-12 w-[min(70%,16rem)] rounded-2xl" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[min(55%,12rem)] rounded-2xl" />
        </div>
        <div className="flex justify-start">
          <Skeleton className="h-16 w-[min(75%,18rem)] rounded-2xl" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-[min(45%,10rem)] rounded-2xl" />
        </div>
      </div>
      <div className="border-t border-zinc-100 px-3 py-3">
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Own/other profile while data loads. */
export function ProfileSkeleton({ className = "" }: SkeletonProps) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={`w-full ${className}`}>
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="relative px-4 pb-8">
        <Skeleton className="-mt-10 h-20 w-20 rounded-full border-4 border-white" />
        <Skeleton className="mt-4 h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full" />
        <div className="mt-4 flex gap-6">
          <Skeleton className="h-8 w-14" />
          <Skeleton className="h-8 w-14" />
          <Skeleton className="h-8 w-14" />
        </div>
        <div className="mt-6 flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>
        <div className="mt-6 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-64 max-w-[90%]" />
          <Skeleton className="h-4 w-48 max-w-[70%]" />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Generic project workspace / settings-style page body. */
export function WorkspacePageSkeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={`space-y-4 py-1 ${className}`}
    >
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-7 w-48 max-w-[70%]" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Compact people / follow / pick-list rows. */
export function PeopleListSkeleton({ count = 6, className = "" }: CountProps) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={`space-y-1 ${className}`}>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-44 max-w-[80%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Card grid (discover / home match results). */
export function CardGridSkeleton({ count = 6, className = "" }: CountProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={`mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${className}`}
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-zinc-100 bg-white">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Simple stacked bars for panels / notices / file lists. */
export function StackSkeleton({ count = 4, className = "" }: CountProps) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={`space-y-3 ${className}`}>
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}
