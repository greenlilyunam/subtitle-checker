import type {
  Issue,
  RulesConfig,
  SubtitleEntry,
  StructureRuleId,
} from "../../types";

function makeIssue(
  entry: SubtitleEntry,
  ruleId: StructureRuleId,
  message: string,
  detail?: string,
): Issue {
  const originalValue =
    ruleId === "checkSequence"
      ? entry.sequenceRaw
      : ruleId === "checkEmptySubtitle"
        ? entry.workingText
        : entry.timecodeRaw;
  const fingerprint = `${entry.id}|${ruleId}|${originalValue}|${message}`;
  return {
    id: fingerprint,
    entryId: entry.id,
    ruleId,
    category: "structure",
    severity: ruleId === "checkSequence" ? "warning" : "error",
    status: "structural",
    message,
    originalValue,
    detail,
    fingerprint,
  };
}

export function checkStructure(
  entries: SubtitleEntry[],
  rules: RulesConfig,
): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<number>();

  entries.forEach((entry, index) => {
    if (rules.checkSequence) {
      const messages: string[] = [];
      if (entry.originalIndex === null) messages.push("序号不是正整数");
      if (entry.originalIndex !== null && seen.has(entry.originalIndex))
        messages.push("序号重复");
      if (index === 0 && entry.originalIndex !== 1)
        messages.push("序号未从 1 开始");
      if (index > 0) {
        const previous = entries[index - 1].originalIndex;
        if (
          entry.originalIndex === null ||
          previous === null ||
          entry.originalIndex !== previous + 1
        )
          messages.push("相邻序号不连续");
      }
      if (entry.originalIndex !== null) seen.add(entry.originalIndex);
      if (messages.length > 0)
        issues.push(
          makeIssue(
            entry,
            "checkSequence",
            messages.join("；"),
            `原始序号：${entry.sequenceRaw || "缺失"}`,
          ),
        );
    }

    if (rules.checkTimecode) {
      const timeErrors = entry.parseErrors.filter((error) =>
        ["missing_timecode", "invalid_timecode", "invalid_time_range"].includes(
          error.code,
        ),
      );
      if (timeErrors.length > 0)
        issues.push(
          makeIssue(
            entry,
            "checkTimecode",
            timeErrors.map((error) => error.message).join("；"),
            `原始时间码：${entry.timecodeRaw || "缺失"}`,
          ),
        );
    }

    if (rules.checkEmptySubtitle && entry.workingText.trim().length === 0) {
      issues.push(
        makeIssue(
          entry,
          "checkEmptySubtitle",
          "字幕文本为空",
          "结构问题只提示，不会自动删除字幕块",
        ),
      );
    }
  });

  if (rules.checkOverlap) {
    for (let index = 1; index < entries.length; index += 1) {
      const previous = entries[index - 1];
      const current = entries[index];
      if (
        previous.endMs !== null &&
        current.startMs !== null &&
        current.startMs < previous.endMs
      ) {
        const overlap = previous.endMs - current.startMs;
        issues.push(
          makeIssue(
            current,
            "checkOverlap",
            `与上一条字幕重叠 ${overlap} 毫秒`,
            `${previous.timecodeRaw} → ${current.timecodeRaw}`,
          ),
        );
      }
    }
  }

  return issues;
}
