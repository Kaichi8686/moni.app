"use client";

export function Avatar({
  name,
  url,
  size = "sm",
}: {
  name: string;
  url?: string | null;
  size?: "sm" | "md";
}) {
  const s = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  const initial = name.trim().slice(0, 1) || "?";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={`${s} shrink-0 rounded-full object-cover ring-1 ring-[#E5E7EB]`} />
    );
  }
  return (
    <div
      className={`${s} flex shrink-0 items-center justify-center rounded-full bg-[#F7F8F8] font-semibold text-[#6B7280] ring-1 ring-[#E5E7EB]`}
      aria-hidden
    >
      {initial}
    </div>
  );
}
