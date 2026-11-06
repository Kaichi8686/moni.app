"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MemberAvatarBubble } from "@/components/MemberAvatarBubble";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type MailPerson = {
  id: string;
  conversationId: string;
  displayName: string;
  avatarUrl?: string | null;
  unreadCount?: number;
};

type Props = {
  people: MailPerson[];
  onSelect: (conversationId: string) => void;
};

const ITEM_PX = 64;

/**
 * メールタブ先頭：相手を上下スナップで切り替え。
 * 1番上／1番下の人が見えたら、それ以上はスクロールしない。
 */
export function MailPeopleReel({ people, onSelect }: Props) {
  const { tx } = useI18n();
  const reelRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const syncActiveFromScroll = useCallback(() => {
    const el = reelRef.current;
    if (!el || people.length === 0) return;
    const idx = Math.round(el.scrollTop / ITEM_PX);
    setActiveIndex(Math.max(0, Math.min(people.length - 1, idx)));
  }, [people.length]);

  useEffect(() => {
    setActiveIndex(0);
    const el = reelRef.current;
    if (el) el.scrollTop = 0;
  }, [people]);

  useEffect(() => {
    const el = reelRef.current;
    if (!el || people.length === 0) return;

    const clampScroll = () => {
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      if (el.scrollTop < 0) el.scrollTop = 0;
      else if (el.scrollTop > max) el.scrollTop = max;
    };

    const onWheel = (event: WheelEvent) => {
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop >= max - 0.5;
      if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
        event.preventDefault();
        event.stopPropagation();
        clampScroll();
      }
    };

    const onScroll = () => {
      clampScroll();
      syncActiveFromScroll();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
    };
  }, [people.length, syncActiveFromScroll]);

  if (people.length === 0) return null;

  const active = people[activeIndex] ?? people[0];

  return (
    <div className="border-b border-zinc-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          ref={reelRef}
          className="h-16 w-16 shrink-0 snap-y snap-mandatory overflow-y-auto overscroll-y-none rounded-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
          role="listbox"
          aria-label={tx("メールの相手", "Mail contacts")}
          aria-activedescendant={active ? `mail-reel-${active.id}` : undefined}
        >
          {people.map((person, index) => (
            <button
              key={person.conversationId}
              id={`mail-reel-${person.id}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => onSelect(person.conversationId)}
              className="relative flex h-16 w-16 shrink-0 snap-start snap-always items-center justify-center"
            >
              <MemberAvatarBubble
                userId={person.id}
                name={person.displayName}
                avatarUrl={person.avatarUrl}
                size="md"
                className="!h-14 !w-14"
              />
              {person.unreadCount && person.unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-bold leading-none text-white">
                  {person.unreadCount > 99 ? "99+" : person.unreadCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onSelect(active.conversationId)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-base font-semibold tracking-tight text-zinc-900">
            {active.displayName}
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {people.length === 1
              ? tx("タップしてメールを開く", "Tap to open mail")
              : tx("上下にスライドして相手を切り替え", "Slide up/down to switch")}
          </p>
        </button>

        {people.length > 1 && people.length <= 10 ? (
          <div className="flex shrink-0 flex-col gap-1" aria-hidden>
            {people.map((person, index) => (
              <span
                key={person.conversationId}
                className={`h-1.5 w-1.5 rounded-full ${
                  index === activeIndex ? "bg-zinc-800" : "bg-zinc-300"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
