/** 線アイコン（絵文字不使用） */

type IconProps = { className?: string; size?: number };

export function IconCoin({ className, size = 18 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c.8-1 2-1.5 3-1.5s2.2.5 3 1.5M9 14.5c.8 1 2 1.5 3 1.5s2.2-.5 3-1.5" />
    </svg>
  );
}

export function IconBolt({ className, size = 18 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 2 4 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

export function IconCalendar({ className, size = 18 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
