import type { GlossaryEntry } from "../../types/localization";

interface ProtectedMatch {
  start: number;
  end: number;
  value: string;
  rank: number;
}

const TECHNICAL_PATTERNS = [
  /https?:\/\/[^\s<>"'，。！？；：]+/giu,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,
  /\b[vV]\d+(?:\.\d+){1,}\b/gu,
  /\b(?:[A-Z]{2,}[ -]?\d[A-Z0-9.-]*|[A-Z]{2,}-[A-Z0-9.-]+)\b/gu,
  /<[^>]+>/gu,
];

export class ProtectionContext {
  private readonly values: string[] = [];

  reserve(value: string): string {
    const index = this.values.push(value) - 1;
    return String.fromCharCode(0xe000 + index);
  }

  restore(text: string): string {
    return [...text]
      .map((character) => {
        const index = character.charCodeAt(0) - 0xe000;
        return index >= 0 && index < this.values.length
          ? this.values[index]
          : character;
      })
      .join("");
  }

  valueFor(character: string): string | undefined {
    const index = character.charCodeAt(0) - 0xe000;
    return index >= 0 && index < this.values.length
      ? this.values[index]
      : undefined;
  }
}

function termMatches(text: string, term: string): ProtectedMatch[] {
  const matches: ProtectedMatch[] = [];
  const caseInsensitive = /[A-Za-z]/.test(term);
  const haystack = caseInsensitive ? text.toLocaleLowerCase("en-US") : text;
  const needle = caseInsensitive ? term.toLocaleLowerCase("en-US") : term;
  let start = 0;
  while ((start = haystack.indexOf(needle, start)) >= 0) {
    matches.push({
      start,
      end: start + term.length,
      value: text.slice(start, start + term.length),
      rank: 2,
    });
    start += Math.max(1, term.length);
  }
  return matches;
}

export function protectText(
  text: string,
  glossary: GlossaryEntry[],
  protectTechnical = true,
  builtinProtectTerms: string[] = [],
): { text: string; context: ProtectionContext } {
  const context = new ProtectionContext();
  const matches: ProtectedMatch[] = [];
  glossary
    .filter((entry) => entry.enabled && entry.action === "protect")
    .forEach((entry) => matches.push(...termMatches(text, entry.sourceTerm)));
  builtinProtectTerms.forEach((term) =>
    matches.push(
      ...termMatches(text, term).map((match) => ({ ...match, rank: 1 })),
    ),
  );
  if (protectTechnical)
    TECHNICAL_PATTERNS.forEach((pattern) => {
      for (const match of text.matchAll(pattern))
        if (match.index !== undefined)
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            value: match[0],
            rank: 0,
          });
    });
  matches.sort(
    (a, b) =>
      a.start - b.start ||
      b.rank - a.rank ||
      b.end - b.start - (a.end - a.start),
  );
  const selected: ProtectedMatch[] = [];
  let cursor = -1;
  matches.forEach((match) => {
    if (match.start >= cursor) {
      selected.push(match);
      cursor = match.end;
    }
  });
  let output = "";
  cursor = 0;
  selected.forEach((match) => {
    output += text.slice(cursor, match.start) + context.reserve(match.value);
    cursor = match.end;
  });
  output += text.slice(cursor);
  return { text: output, context };
}
