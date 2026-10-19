export type TaskMode = "basic" | "localization";
export type LocalizationDirection = "zh-CN_zh-TW" | "zh-CN_en";

export type LocalizationAction = "replace" | "suggest" | "protect" | "warn";
export type LocalizationRisk = "low" | "medium" | "high";
export type LocalizationStatus = "pending" | "accepted" | "ignored" | "edited";
export type LocalizationSource =
  | "custom-glossary"
  | "builtin-glossary"
  | "character"
  | "format"
  | "conflict"
  | "risk-scan";
export type LocalizationType =
  | "character"
  | "regional"
  | "technical"
  | "format"
  | "custom"
  | "warning"
  | "conflict";

export interface GlossaryEntry {
  id: string;
  sourceTerm: string;
  targetTerm: string;
  action: LocalizationAction;
  note?: string;
  enabled: boolean;
  priority: number;
  source: "custom" | "builtin";
}

export interface GlossaryImportError {
  line: number;
  reason: string;
}

export interface GlossaryConflict {
  sourceTerm: string;
  priority: number;
  targetTerms: string[];
  entryIds: string[];
}

export interface GlossaryImportResult {
  entries: GlossaryEntry[];
  errors: GlossaryImportError[];
  duplicateCount: number;
  conflicts: GlossaryConflict[];
  detectedLayout?: string;
}

export interface LocalizationRulesConfig {
  convertCharacters: boolean;
  useTaiwanTerms: boolean;
  useSoftwareTerms: boolean;
  formatSpacing: boolean;
  protectTechnical: boolean;
  scanRisks: boolean;
}

export const DEFAULT_LOCALIZATION_RULES: LocalizationRulesConfig = {
  convertCharacters: true,
  useTaiwanTerms: true,
  useSoftwareTerms: true,
  formatSpacing: true,
  protectTechnical: true,
  scanRisks: true,
};

export interface LocalizationChange {
  id: string;
  type: LocalizationType;
  source: LocalizationSource;
  risk: LocalizationRisk;
  reason: string;
  matchedTerm: string;
  replacement?: string;
  action: LocalizationAction | "convert" | "format" | "conflict";
  conflictTargets?: string[];
}

export interface LocalizationIssue {
  id: string;
  entryId: string;
  originalText: string;
  suggestedText: string;
  acceptedText?: string;
  editedText?: string;
  changes: LocalizationChange[];
  types: LocalizationType[];
  sources: LocalizationSource[];
  risk: LocalizationRisk;
  status: LocalizationStatus;
  hasConflict: boolean;
  fingerprint: string;
}

export interface LocalizationSnapshot {
  issues: LocalizationIssue[];
  selectedIssueIds: string[];
  label: string;
}
