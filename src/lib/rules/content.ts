import type { ContentRuleId } from "../../types";

const PUNCTUATION = new Set([
  ".",
  ",",
  ";",
  ":",
  "!",
  "?",
  "。",
  "，",
  "；",
  "：",
  "！",
  "？",
  "…",
]);
const CLOSERS = new Set([
  '"',
  "'",
  "”",
  "’",
  ")",
  "]",
  "}",
  "》",
  "」",
  "』",
  "】",
]);

export function removeTrailingPunctuation(text: string): string {
  let last = text.length - 1;
  while (last >= 0 && /\s/u.test(text[last])) last -= 1;
  if (last < 0) return text;

  let punctuationEnd = last;
  while (punctuationEnd >= 0 && CLOSERS.has(text[punctuationEnd]))
    punctuationEnd -= 1;
  let punctuationStart = punctuationEnd;
  while (punctuationStart >= 0 && PUNCTUATION.has(text[punctuationStart]))
    punctuationStart -= 1;
  if (punctuationStart === punctuationEnd) return text;

  const result =
    text.slice(0, punctuationStart + 1) + text.slice(punctuationEnd + 1);
  return result.trim().length === 0 ? text : result;
}

export function capitalizeEnglishStart(text: string): string {
  const index = text.search(/[A-Za-z]/);
  if (index < 0) return text;
  const prefix = text.slice(0, index);
  if (/\p{Script=Han}/u.test(prefix)) return text;
  const letter = text[index];
  if (!/[a-z]/.test(letter)) return text;
  return text.slice(0, index) + letter.toUpperCase() + text.slice(index + 1);
}

export function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line.replace(/^[ \t]+|[ \t]+$/g, "").replace(/[ \t]{2,}/g, " "),
    )
    .join("\n");
}

export const CONTENT_RULE_ORDER: ContentRuleId[] = [
  "normalizeWhitespace",
  "capitalizeEnglishStart",
  "removeTrailingPunctuation",
];

export function applyContentRule(ruleId: ContentRuleId, text: string): string {
  if (ruleId === "normalizeWhitespace") return normalizeWhitespace(text);
  if (ruleId === "capitalizeEnglishStart") return capitalizeEnglishStart(text);
  return removeTrailingPunctuation(text);
}

export function applyEnabledContentRules(
  text: string,
  enabled: ContentRuleId[],
): string {
  return CONTENT_RULE_ORDER.reduce(
    (result, ruleId) =>
      enabled.includes(ruleId) ? applyContentRule(ruleId, result) : result,
    text,
  );
}
