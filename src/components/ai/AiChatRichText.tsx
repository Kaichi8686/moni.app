"use client";

import { Fragment, type ReactNode } from "react";

type Props = {
  text: string;
  className?: string;
};

/** Renders AI chat text with `**bold**` and preserved newlines (emojis pass through). */
export function AiChatRichText({ text, className }: Props) {
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 ? <br /> : null}
          {renderInline(line)}
        </Fragment>
      ))}
    </div>
  );
}

function renderInline(line: string): ReactNode[] {
  const parts = line.split(/(\*\*[^*\n]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.length >= 4 && part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
