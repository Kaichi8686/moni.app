"use client";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
  size?: "md" | "lg" | "xl";
  /** Kept for API compatibility; unused when no photo (tone-on-tone zinc). */
  accentColor?: string;
};

const SIZES = {
  md: { box: "h-10 w-10 text-sm", radius: "rounded-lg" },
  lg: { box: "h-20 w-20 text-2xl", radius: "rounded-xl" },
  xl: { box: "h-[72px] w-[72px] text-2xl", radius: "rounded-xl" },
} as const;

export function ProfileAvatar({ displayName, avatarUrl, size = "md" }: Props) {
  const { box, radius } = SIZES[size];
  const initial = (displayName.trim().charAt(0) || "?").toUpperCase();

  return (
    <div className={`${box} ${radius} shrink-0 overflow-hidden border border-zinc-200 bg-zinc-100 shadow-[0_1px_0_rgba(24,24,27,0.04)]`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-bold tracking-tight text-white"
          style={{ background: "linear-gradient(145deg, #52525b 0%, #27272a 55%, #18181b 100%)" }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
