"use client";

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-[#EDE9E4] ${className}`}>
      <div
        className="h-full rounded-full bg-[var(--brand,#ff5c35)] transition-all duration-300 ease-out"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
