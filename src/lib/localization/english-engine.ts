import type { SubtitleEntry } from "../../types";
import type {
  GlossaryEntry,
  LocalizationChange,
  LocalizationIssue,
} from "../../types/localization";
import { detectGlossaryConflicts } from "./glossary";
import { protectText, type ProtectionContext } from "./protection";

function matchesAt(text: string, index: number, term: string): boolean {
  const segment = text.slice(index, index + term.length);
  return /[A-Za-z]/.test(term)
    ? segment.toLocaleLowerCase("en-US") === term.toLocaleLowerCase("en-US")
    : segment === term;
}

function addEnglishSpacing(text: string, context: ProtectionContext): string {
  let output = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const value = context.valueFor(character);
    if (!value) {
      output += character;
      continue;
    }
    const previous = output.at(-1) ?? "";
    const next = text[index + 1] ?? "";
    if (/\p{Script=Han}/u.test(previous) && /^[A-Za-z0-9]/.test(value))
      output += " ";
    output += character;
    if (/[A-Za-z0-9]$/.test(value) && /\p{Script=Han}/u.test(next))
      output += " ";
  }
  return output.replace(/[ \t]{2,}/g, " ").trim();
}

export function translateWithEnglishGlossary(
  originalText: string,
  glossary: GlossaryEntry[],
): Omit<LocalizationIssue, "id" | "entryId" | "status" | "fingerprint"> | null {
  const conflicts = detectGlossaryConflicts(glossary);
  const protectedResult = protectText(originalText, glossary, true);
  const active = glossary.filter(
    (entry) => entry.enabled && entry.action !== "protect",
  );
  const terms = [...new Set(active.map((entry) => entry.sourceTerm))].sort(
    (a, b) => b.length - a.length,
  );
  const conflictMap = new Map(
    conflicts.map((conflict) => [conflict.sourceTerm, conflict]),
  );
  const changes: LocalizationChange[] = [];
  let output = "";
  let index = 0;

  while (index < protectedResult.text.length) {
    const term = terms.find((candidate) =>
      matchesAt(protectedResult.text, index, candidate),
    );
    if (!term) {
      output += protectedResult.text[index];
      index += 1;
      continue;
    }
    const candidates = active.filter((entry) => entry.sourceTerm === term);
    const highest = Math.max(...candidates.map((entry) => entry.priority));
    const top = candidates.filter((entry) => entry.priority === highest);
    const conflict = conflictMap.get(term);
    const original = protectedResult.text.slice(index, index + term.length);
    if (conflict) {
      output += protectedResult.context.reserve(original);
      changes.push({
        id: `en-conflict-${index}-${term}`,
        type: "conflict",
        source: "conflict",
        risk: "high",
        action: "conflict",
        matchedTerm: term,
        reason: `“${term}”存在多个英文译法，未自动处理`,
        conflictTargets: conflict.targetTerms,
      });
    } else {
      const chosen =
        top.find((entry) => entry.action === "replace") ??
        top.find((entry) => entry.action === "suggest") ??
        top[0];
      if (chosen.action === "replace" || chosen.action === "suggest") {
        output += protectedResult.context.reserve(chosen.targetTerm);
      } else {
        output += protectedResult.context.reserve(original);
      }
      changes.push({
        id: `en-custom-${chosen.id}-${index}`,
        type: chosen.action === "warn" ? "warning" : "custom",
        source: "custom-glossary",
        risk: chosen.action === "replace" ? "low" : "medium",
        action: chosen.action,
        matchedTerm: chosen.sourceTerm,
        replacement: chosen.targetTerm || undefined,
        reason:
          chosen.note ||
          (chosen.action === "warn"
            ? `术语“${chosen.sourceTerm}”需要人工翻译`
            : `中英对照表指定为“${chosen.targetTerm}”`),
      });
    }
    index += term.length;
  }

  output = addEnglishSpacing(output, protectedResult.context);
  const remainingChinese = output.match(/[\p{Script=Han}]+/gu) ?? [];
  if (remainingChinese.length > 0) {
    changes.push({
      id: "en-untranslated-content",
      type: "warning",
      source: "risk-scan",
      risk: "high",
      action: "warn",
      matchedTerm: [...new Set(remainingChinese)].slice(0, 4).join("、"),
      reason: "仍有中文未被中英对照表覆盖，请手动补充英文译文",
    });
  }

  const suggestedText = protectedResult.context.restore(output);
  if (changes.length === 0 && suggestedText === originalText) return null;
  return {
    originalText,
    suggestedText,
    changes,
    types: [...new Set(changes.map((change) => change.type))],
    sources: [...new Set(changes.map((change) => change.source))],
    risk: changes.some((change) => change.risk === "high")
      ? "high"
      : changes.some((change) => change.risk === "medium")
        ? "medium"
        : "low",
    hasConflict: changes.some((change) => change.type === "conflict"),
  };
}

export function runEnglishLocalization(
  entries: SubtitleEntry[],
  glossary: GlossaryEntry[],
): LocalizationIssue[] {
  return entries.flatMap((entry) => {
    const result = translateWithEnglishGlossary(entry.originalText, glossary);
    if (!result) return [];
    return [
      {
        ...result,
        id: `english-${entry.id}`,
        entryId: entry.id,
        status: "pending" as const,
        fingerprint: `${entry.id}|${entry.originalText}|${result.suggestedText}`,
      },
    ];
  });
}
