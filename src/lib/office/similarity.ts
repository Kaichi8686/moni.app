/** 文字 bigram の Jaccard 類似度（0〜1） */
export function charBigramJaccard(a: string, b: string): number {
  const left = normalize(a);
  const right = normalize(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;

  const setA = bigrams(left);
  const setB = bigrams(right);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let inter = 0;
  for (const g of setA) {
    if (setB.has(g)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function isTooSimilar(answer: string, recent: string[], threshold: number): boolean {
  return recent.some((prev) => charBigramJaccard(answer, prev) >= threshold);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function bigrams(text: string): Set<string> {
  const out = new Set<string>();
  if (text.length < 2) {
    if (text.length === 1) out.add(text);
    return out;
  }
  for (let i = 0; i < text.length - 1; i++) {
    out.add(text.slice(i, i + 2));
  }
  return out;
}
