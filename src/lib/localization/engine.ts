import type { SubtitleEntry } from "../../types";
import type {
  GlossaryEntry,
  LocalizationChange,
  LocalizationIssue,
  LocalizationRisk,
  LocalizationRulesConfig,
} from "../../types/localization";
import {
  BUILTIN_PROTECT_TERMS,
  BUILTIN_TERMS,
  type BuiltinTerm,
} from "./builtin-terms";
import {
  convertToSimplifiedChinese,
  convertToTaiwanTraditional,
} from "./opencc-adapter";
import { protectText, type ProtectionContext } from "./protection";

const RISK_SCORE: Record<LocalizationRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function maxRisk(changes: LocalizationChange[]): LocalizationRisk {
  return changes.reduce<LocalizationRisk>(
    (risk, change) =>
      RISK_SCORE[change.risk] > RISK_SCORE[risk] ? change.risk : risk,
    "low",
  );
}

function matchesAt(text: string, index: number, term: string): boolean {
  const segment = text.slice(index, index + term.length);
  return /[A-Za-z]/.test(term)
    ? segment.toLocaleLowerCase("en-US") === term.toLocaleLowerCase("en-US")
    : segment === term;
}

function customChange(entry: GlossaryEntry, index: number): LocalizationChange {
  return {
    id: `custom-${entry.id}-${index}`,
    type: entry.action === "warn" ? "warning" : "custom",
    source: "custom-glossary",
    risk:
      entry.action === "suggest" || entry.action === "warn" ? "medium" : "low",
    reason:
      entry.note ||
      `企业术语表将“${entry.sourceTerm}”指定为“${entry.targetTerm}”`,
    matchedTerm: entry.sourceTerm,
    replacement: entry.targetTerm || undefined,
    action: entry.action,
  };
}

function applyCustomGlossary(
  text: string,
  glossary: GlossaryEntry[],
  context: ProtectionContext,
): { text: string; changes: LocalizationChange[] } {
  type MatchableEntry = GlossaryEntry & { matchTerm: string };
  const enabledBase: MatchableEntry[] = glossary
    .filter((entry) => entry.enabled && entry.action !== "protect")
    .flatMap((entry) =>
      [
        ...new Set([
          entry.sourceTerm,
          convertToSimplifiedChinese(entry.sourceTerm),
        ]),
      ]
        .filter(Boolean)
        .map((matchTerm) => ({ ...entry, matchTerm })),
    );
  const shorthandEntries = enabledBase.flatMap((entry) => {
    if (
      (entry.action === "replace" || entry.action === "suggest") &&
      entry.matchTerm.endsWith("监控") &&
      entry.targetTerm.endsWith("監控")
    ) {
      const shortSource = entry.matchTerm.slice(0, -2);
      return shortSource
        ? [
            {
              ...entry,
              id: `${entry.id}-module-shorthand`,
              matchTerm: shortSource,
              note: entry.note || "沿用企业模块名称",
            },
          ]
        : [];
    }
    return [];
  });
  const enabled = [...enabledBase, ...shorthandEntries];
  const terms = [...new Set(enabled.map((entry) => entry.matchTerm))].sort(
    (a, b) => b.length - a.length,
  );
  const changes: LocalizationChange[] = [];
  let output = "";
  let index = 0;
  while (index < text.length) {
    const term = terms.find((candidate) => matchesAt(text, index, candidate));
    if (!term) {
      output += text[index];
      index += 1;
      continue;
    }
    const candidates = enabled.filter(
      (entry) =>
        entry.matchTerm === term ||
        (/[A-Za-z]/.test(term) &&
          entry.matchTerm.toLocaleLowerCase("en-US") ===
            term.toLocaleLowerCase("en-US")),
    );
    const highest = Math.max(...candidates.map((entry) => entry.priority));
    const top = candidates.filter((entry) => entry.priority === highest);
    const conflictTargets = [
      ...new Set(
        top
          .filter(
            (entry) => entry.action === "replace" || entry.action === "suggest",
          )
          .map((entry) => entry.targetTerm),
      ),
    ];
    const original = text.slice(index, index + term.length);
    if (conflictTargets.length > 1) {
      output += context.reserve(original);
      changes.push({
        id: `conflict-${index}-${term}`,
        type: "conflict",
        source: "conflict",
        risk: "high",
        action: "conflict",
        matchedTerm: term,
        reason: `“${term}”在相同优先级下存在多个目标词，未自动处理`,
        conflictTargets,
      });
    } else {
      const chosen =
        top.find((entry) => entry.action === "replace") ??
        top.find((entry) => entry.action === "suggest") ??
        top[0];
      changes.push(customChange(chosen, index));
      if (chosen.action === "replace" || chosen.action === "suggest")
        output += context.reserve(chosen.targetTerm);
      else output += original;
    }
    index += term.length;
  }
  return { text: output, changes };
}

interface PreparedBuiltin extends BuiltinTerm {
  patterns: string[];
}

function prepareBuiltins(rules: LocalizationRulesConfig): PreparedBuiltin[] {
  return BUILTIN_TERMS.filter((term) =>
    term.group === "regional" ? rules.useTaiwanTerms : rules.useSoftwareTerms,
  )
    .map((term) => ({
      ...term,
      patterns: [
        ...new Set([term.source, convertToTaiwanTraditional(term.source)]),
      ].sort((a, b) => b.length - a.length),
    }))
    .sort(
      (a, b) =>
        Math.max(...b.patterns.map((pattern) => pattern.length)) -
        Math.max(...a.patterns.map((pattern) => pattern.length)),
    );
}

function applyBuiltins(
  text: string,
  rules: LocalizationRulesConfig,
): { text: string; changes: LocalizationChange[] } {
  const terms = prepareBuiltins(rules);
  const changes: LocalizationChange[] = [];
  let output = "";
  let index = 0;
  while (index < text.length) {
    let found: { term: PreparedBuiltin; pattern: string } | undefined;
    for (const term of terms) {
      const pattern = term.patterns.find((candidate) =>
        text.startsWith(candidate, index),
      );
      if (pattern && (!found || pattern.length > found.pattern.length))
        found = { term, pattern };
    }
    if (!found) {
      output += text[index];
      index += 1;
      continue;
    }
    const { term, pattern } = found;
    const replacement = term.action === "warn" ? pattern : term.target;
    output += replacement;
    if (replacement !== pattern || term.action === "warn") {
      changes.push({
        id: `builtin-${index}-${term.source}`,
        type: term.action === "warn" ? "warning" : term.type,
        source: "builtin-glossary",
        risk: term.risk,
        reason: term.reason,
        matchedTerm: term.source,
        replacement: term.action === "warn" ? undefined : term.target,
        action: term.action,
      });
    }
    index += pattern.length;
  }
  return { text: output, changes };
}

function applyFormatRules(text: string, context: ProtectionContext): string {
  let withPlaceholderBoundaries = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const value = context.valueFor(character);
    if (!value) {
      withPlaceholderBoundaries += character;
      continue;
    }
    const previous = withPlaceholderBoundaries.at(-1) ?? "";
    const next = text[index + 1] ?? "";
    if (/\p{Script=Han}/u.test(previous) && /^[A-Za-z0-9]/.test(value))
      withPlaceholderBoundaries += " ";
    withPlaceholderBoundaries += character;
    if (/[A-Za-z0-9]$/.test(value) && /\p{Script=Han}/u.test(next))
      withPlaceholderBoundaries += " ";
  }
  return withPlaceholderBoundaries
    .split("\n")
    .map((line) =>
      line
        .replace(/([\p{Script=Han}])([A-Za-z][A-Za-z0-9._+-]*)/gu, "$1 $2")
        .replace(/([A-Za-z][A-Za-z0-9._+-]*)([\p{Script=Han}])/gu, "$1 $2")
        .replace(/[ \t]{2,}/g, " "),
    )
    .join("\n");
}

function addRiskScan(
  text: string,
  changes: LocalizationChange[],
  rules: LocalizationRulesConfig,
) {
  if (!rules.scanRisks) return;
  const activeSources = BUILTIN_TERMS.filter((term) =>
    term.group === "regional" ? rules.useTaiwanTerms : rules.useSoftwareTerms,
  ).map((term) => term.source);
  const remaining = activeSources.filter((term) => text.includes(term));
  if (remaining.length > 0)
    changes.push({
      id: `risk-unconverted-${remaining.join("-")}`,
      type: "warning",
      source: "risk-scan",
      risk: "medium",
      action: "warn",
      reason: `仍存在疑似大陆用语：${remaining.join("、")}`,
      matchedTerm: remaining.join("、"),
    });
  if (text.includes("管理管理後台"))
    changes.push({
      id: "risk-duplicate-target",
      type: "warning",
      source: "risk-scan",
      risk: "medium",
      action: "warn",
      reason: "建议文本出现重复目标词“管理管理後台”",
      matchedTerm: "管理管理後台",
    });
  if (text.trim().length === 0)
    changes.push({
      id: "risk-empty",
      type: "warning",
      source: "risk-scan",
      risk: "high",
      action: "warn",
      reason: "本土化结果为空文本，请人工检查",
      matchedTerm: "空文本",
    });
}

export function localizeText(
  originalText: string,
  rules: LocalizationRulesConfig,
  glossary: GlossaryEntry[],
): Omit<LocalizationIssue, "id" | "entryId" | "status" | "fingerprint"> | null {
  const activeBuiltins = BUILTIN_TERMS.filter((term) =>
    term.group === "regional" ? rules.useTaiwanTerms : rules.useSoftwareTerms,
  );
  const idempotentTargets = activeBuiltins
    .map((term) => term.target)
    .filter(Boolean);
  const customTargets = glossary
    .filter(
      (entry) =>
        entry.enabled &&
        (entry.action === "replace" || entry.action === "suggest"),
    )
    .map((entry) => entry.targetTerm);
  const protectedResult = protectText(
    originalText,
    glossary,
    rules.protectTechnical,
    [
      ...(rules.useSoftwareTerms ? BUILTIN_PROTECT_TERMS : []),
      ...idempotentTargets,
      ...customTargets,
    ],
  );
  const custom = applyCustomGlossary(
    protectedResult.text,
    glossary,
    protectedResult.context,
  );
  const changes = [...custom.changes];
  const converted = rules.convertCharacters
    ? convertToTaiwanTraditional(custom.text)
    : custom.text;
  if (converted !== custom.text)
    changes.push({
      id: "character-conversion",
      type: "character",
      source: "character",
      risk: "low",
      action: "convert",
      reason: "将未保护的简体中文转换为台湾繁体字",
      matchedTerm: "简体字符",
    });
  const builtin = applyBuiltins(converted, rules);
  changes.push(...builtin.changes);
  const formatted = rules.formatSpacing
    ? applyFormatRules(builtin.text, protectedResult.context)
    : builtin.text;
  if (formatted !== builtin.text)
    changes.push({
      id: "format-spacing",
      type: "format",
      source: "format",
      risk: "low",
      action: "format",
      reason: "规范拉丁字母或数字技术词与中文之间的半角空格",
      matchedTerm: "中英文空格",
    });
  addRiskScan(formatted, changes, rules);
  const suggestedText = protectedResult.context.restore(formatted);
  if (suggestedText === originalText && changes.length === 0) return null;
  return {
    originalText,
    suggestedText,
    changes,
    types: [...new Set(changes.map((change) => change.type))],
    sources: [...new Set(changes.map((change) => change.source))],
    risk: maxRisk(changes),
    hasConflict: changes.some((change) => change.type === "conflict"),
  };
}

export function runLocalization(
  entries: SubtitleEntry[],
  rules: LocalizationRulesConfig,
  glossary: GlossaryEntry[],
): LocalizationIssue[] {
  return entries.flatMap((entry) => {
    const result = localizeText(entry.originalText, rules, glossary);
    if (!result) return [];
    const fingerprint = `${entry.id}|${entry.originalText}|${result.suggestedText}|${result.changes.map((change) => change.id).join(",")}`;
    return [
      {
        ...result,
        id: `localization-${entry.id}`,
        entryId: entry.id,
        status: "pending" as const,
        fingerprint,
      },
    ];
  });
}

export function localizationOutputText(
  issue: LocalizationIssue | undefined,
): string | undefined {
  if (!issue) return undefined;
  if (issue.status === "accepted")
    return issue.acceptedText ?? issue.suggestedText;
  if (issue.status === "edited") return issue.editedText ?? issue.originalText;
  return issue.originalText;
}
