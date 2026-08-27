"use client";

type Props = { isOnline?: boolean };

export function OnlineIndicator({ isOnline }: Props) {
  if (!isOnline) return null;
  return <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" aria-hidden />;
}
