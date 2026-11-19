/**
 * iOS Safari can leave the layout viewport shorter than the visual screen after
 * a `position:fixed` fullscreen shell + soft keyboard. Fixed layers then only
 * paint the top half and a blank (usually white) gap fills the rest — and it
 * sticks across client navigations until something forces a reflow.
 */
export function repairIosLayoutViewport() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable)
  ) {
    active.blur();
  }

  const root = document.documentElement;
  const body = document.body;
  const prevRootHeight = root.style.height;
  const prevBodyMinHeight = body.style.minHeight;
  const vv = window.visualViewport;
  const visualBottom = vv ? Math.round(vv.height + vv.offsetTop) : window.innerHeight;
  const target = Math.max(window.innerHeight, visualBottom, window.outerHeight || 0);

  // Nudge scroll + temporary height so Safari recomputes the layout viewport.
  const x = window.scrollX;
  const y = window.scrollY;
  window.scrollTo(x, y + 1);

  root.style.height = `${target + 1}px`;
  body.style.minHeight = `${target + 1}px`;

  requestAnimationFrame(() => {
    window.scrollTo(x, y);
    root.style.height = prevRootHeight;
    body.style.minHeight = prevBodyMinHeight;
    window.scrollTo(0, 0);
    // Second pass after keyboard / chrome chrome settle.
    window.setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
  });
}
