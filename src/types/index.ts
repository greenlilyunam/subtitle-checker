export type ContentRuleId =
  | "removeTrailingPunctuation"
  | "capitalizeEnglishStart"
  | "normalizeWhitespace";

export type StructureRuleId =
  "checkSequence" | "checkTimecode" | "checkEmptySubtitle" | "checkOverlap";

export type RuleId = ContentRuleId | StructureRuleId;

export type RulesConfig = Record<RuleId, boolean>;

export const DEFAULT_RULES: RulesConfig = {
  removeTrailingPunctuation: false,
  capitalizeEnglishStart: false,
  normalizeWhitespace: false,
  checkSequence: true,
  checkTimecode: true,
  checkEmptySubtitle: true,
  checkOverlap: true,
};

export type ParseErrorCode =
  | "missing_sequence"
  | "invalid_sequence"
  | "missing_timecode"
  | "invalid_timecode"
  | "invalid_time_range";

export interface ParseError {
  code: ParseErrorCode;
  message: string;
}

export interface SubtitleEntry {
  id: string;
  order: number;
  originalIndex: number | null;
  sequenceRaw: string;
  timecodeRaw: string;
  startMs: number | null;
  endMs: number | null;
  originalText: string;
  workingText: string;
  rawBlock: string;
  parseErrors: ParseError[];
}

export type IssueStatus =
  "pending" | "accepted" | "ignored" | "manual" | "structural";
export type IssueCategory = "content" | "structure";
export type IssueSeverity = "info" | "warning" | "error";

export interface Issue {
  id: string;
  entryId: string;
  ruleId: RuleId;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  message: string;
  originalValue: string;
  suggestedValue?: string;
  detail?: string;
  fingerprint: string;
}

export interface ParsedSrt {
  entries: SubtitleEntry[];
  hadBom: boolean;
  lineEnding: "\n" | "\r\n";
}

export interface ReviewSnapshot {
  entries: SubtitleEntry[];
  issues: Issue[];
  selectedIssueIds: string[];
  label: string;
}
