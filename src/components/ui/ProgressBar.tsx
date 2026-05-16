"use client";

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB] ${className}`}>
      <div className="h-full rounded-full bg-[#5E6AD2] transition-all duration-150 ease-out" style={{ width: `${v}%` }} />
    </div>
  );
}
