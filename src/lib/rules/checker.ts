import type {
  ContentRuleId,
  Issue,
  RulesConfig,
  SubtitleEntry,
} from "../../types";
import { applyContentRule, CONTENT_RULE_ORDER } from "./content";
import { checkStructure } from "./structure";

export const RULE_LABELS: Record<Issue["ruleId"], string> = {
  removeTrailingPunctuation: "句末标点",
  capitalizeEnglishStart: "英文句首大写",
  normalizeWhitespace: "多余空格",
  checkSequence: "序号问题",
  checkTimecode: "时间码格式",
  checkEmptySubtitle: "空字幕",
  checkOverlap: "时间轴重叠",
};

const RULE_MESSAGES: Record<ContentRuleId, string> = {
  removeTrailingPunctuation: "句末包含可删除的标点符号",
  capitalizeEnglishStart: "可见文本的第一个英文字母应大写",
  normalizeWhitespace: "存在行首尾空格、制表符或连续空格",
};

export function checkContent(
  entries: SubtitleEntry[],
  rules: RulesConfig,
): Issue[] {
  const issues: Issue[] = [];
  entries.forEach((entry) => {
    CONTENT_RULE_ORDER.forEach((ruleId) => {
      if (!rules[ruleId]) return;
      const suggestedValue = applyContentRule(ruleId, entry.workingText);
      if (suggestedValue === entry.workingText) return;
      const fingerprint = `${entry.id}|${ruleId}|${entry.workingText}|${suggestedValue}`;
      issues.push({
        id: fingerprint,
        entryId: entry.id,
        ruleId,
        category: "content",
        severity: "info",
        status: "pending",
        message: RULE_MESSAGES[ruleId],
        originalValue: entry.workingText,
        suggestedValue,
        fingerprint,
      });
    });
  });
  return issues;
}

export function runChecks(
  entries: SubtitleEntry[],
  rules: RulesConfig,
  previous: Issue[] = [],
): Issue[] {
  const findings = [
    ...checkContent(entries, rules),
    ...checkStructure(entries, rules),
  ];
  const previousByFingerprint = new Map(
    previous.map((issue) => [issue.fingerprint, issue]),
  );
  const active = findings.map((issue) => {
    const prior = previousByFingerprint.get(issue.fingerprint);
    return prior?.status === "ignored"
      ? { ...issue, status: "ignored" as const }
      : issue;
  });
  const history = previous.filter(
    (issue) =>
      (issue.status === "accepted" || issue.status === "manual") &&
      !active.some((candidate) => candidate.fingerprint === issue.fingerprint),
  );
  return [...active, ...history].sort((a, b) => {
    const entryA = entries.find((entry) => entry.id === a.entryId)?.order ?? 0;
    const entryB = entries.find((entry) => entry.id === b.entryId)?.order ?? 0;
    return (
      entryA - entryB ||
      CONTENT_RULE_ORDER.indexOf(a.ruleId as ContentRuleId) -
        CONTENT_RULE_ORDER.indexOf(b.ruleId as ContentRuleId)
    );
  });
}
