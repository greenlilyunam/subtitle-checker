import type {
  GlossaryConflict,
  GlossaryEntry,
  GlossaryImportError,
  GlossaryImportResult,
  LocalizationAction,
} from "../../types/localization";

const VALID_ACTIONS = new Set<LocalizationAction>([
  "replace",
  "suggest",
  "protect",
  "warn",
]);
type GlossaryHeader =
  "source_term" | "target_term" | "action" | "note" | "enabled" | "priority";

const HEADER_ALIASES: Record<string, GlossaryHeader> = {
  source_term: "source_term",
  source: "source_term",
  中文: "source_term",
  中文术语: "source_term",
  中文列: "source_term",
  简体中文: "source_term",
  簡體中文: "source_term",
  大陆用语: "source_term",
  大陸用語: "source_term",
  来源词: "source_term",
  來源詞: "source_term",
  原文: "source_term",
  target_term: "target_term",
  target: "target_term",
  english: "target_term",
  英文: "target_term",
  英文术语: "target_term",
  翻译中文列: "target_term",
  翻譯中文列: "target_term",
  台湾用语: "target_term",
  台灣用語: "target_term",
  繁体中文: "target_term",
  繁體中文: "target_term",
  目标词: "target_term",
  目標詞: "target_term",
  英译: "target_term",
  译文: "target_term",
  action: "action",
  处理方式: "action",
  note: "note",
  备注: "note",
  说明: "note",
  enabled: "enabled",
  启用: "enabled",
  priority: "priority",
  优先级: "priority",
};

function normalizeHeader(value: unknown): GlossaryHeader | undefined {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-（）()]/g, "");
  const exact = HEADER_ALIASES[normalized];
  if (exact) return exact;
  if (/^(action|处理|處理)/i.test(normalized)) return "action";
  if (/^(note|备注|備註|说明|說明)/i.test(normalized)) return "note";
  if (/^(enabled|启用|啟用)/i.test(normalized)) return "enabled";
  if (/^(priority|优先|優先)/i.test(normalized)) return "priority";
  if (
    /翻译|翻譯|译文|譯文|台湾|台灣|繁体|繁體|英文|english|目标|目標|target/i.test(
      normalized,
    )
  )
    return "target_term";
  if (/简体|簡體|大陆|大陸|原文|来源|來源|中文|source/i.test(normalized))
    return "source_term";
  return undefined;
}

interface RawGlossaryEntry {
  source_term?: unknown;
  target_term?: unknown;
  action?: unknown;
  note?: unknown;
  enabled?: unknown;
  priority?: unknown;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((candidate) =>
    candidate.some((value) => value.trim().length > 0),
  );
}

function glossaryKey(term: string): string {
  return /[A-Za-z]/.test(term) ? term.toLocaleLowerCase("en-US") : term;
}

function validateEntry(
  raw: RawGlossaryEntry,
  line: number,
): { entry?: GlossaryEntry; error?: GlossaryImportError } {
  const sourceTerm =
    typeof raw.source_term === "string" ? raw.source_term.trim() : "";
  const targetTerm =
    typeof raw.target_term === "string" ? raw.target_term.trim() : "";
  const action =
    typeof raw.action === "string"
      ? (raw.action.trim() as LocalizationAction)
      : ("" as LocalizationAction);
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  if (!sourceTerm) return { error: { line, reason: "缺少 source_term" } };
  if (!VALID_ACTIONS.has(action))
    return {
      error: {
        line,
        reason: "action 必须是 replace、suggest、protect 或 warn",
      },
    };
  if ((action === "replace" || action === "suggest") && !targetTerm)
    return { error: { line, reason: `${action} 类型缺少 target_term` } };

  let enabled = true;
  if (typeof raw.enabled === "boolean") enabled = raw.enabled;
  else if (raw.enabled !== undefined && String(raw.enabled).trim() !== "") {
    const value = String(raw.enabled).trim().toLowerCase();
    if (value !== "true" && value !== "false")
      return { error: { line, reason: "enabled 必须是 true 或 false" } };
    enabled = value === "true";
  }

  let priority = 50;
  if (raw.priority !== undefined && String(raw.priority).trim() !== "") {
    priority = Number(raw.priority);
    if (!Number.isInteger(priority) || priority < 0 || priority > 100)
      return { error: { line, reason: "priority 必须是 0–100 的整数" } };
  }

  return {
    entry: {
      id: `custom-${line}-${sourceTerm}`,
      sourceTerm,
      targetTerm,
      action,
      note: note || undefined,
      enabled,
      priority,
      source: "custom",
    },
  };
}

export function detectGlossaryConflicts(
  entries: GlossaryEntry[],
): GlossaryConflict[] {
  const groups = new Map<string, GlossaryEntry[]>();
  entries
    .filter((entry) => entry.enabled)
    .forEach((entry) => {
      const key = glossaryKey(entry.sourceTerm);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    });
  const conflicts: GlossaryConflict[] = [];
  groups.forEach((group) => {
    if (group.some((entry) => entry.action === "protect")) return;
    const highest = Math.max(...group.map((entry) => entry.priority));
    const top = group.filter(
      (entry) =>
        entry.priority === highest &&
        (entry.action === "replace" || entry.action === "suggest"),
    );
    const targets = [...new Set(top.map((entry) => entry.targetTerm))];
    if (targets.length > 1)
      conflicts.push({
        sourceTerm: top[0].sourceTerm,
        priority: highest,
        targetTerms: targets,
        entryIds: top.map((entry) => entry.id),
      });
  });
  return conflicts;
}

function finalize(
  entries: GlossaryEntry[],
  errors: GlossaryImportError[],
  detectedLayout?: string,
): GlossaryImportResult {
  const unique: GlossaryEntry[] = [];
  const signatures = new Set<string>();
  let duplicateCount = 0;
  entries.forEach((entry) => {
    const signature = JSON.stringify([
      entry.sourceTerm,
      entry.targetTerm,
      entry.action,
      entry.note ?? "",
      entry.enabled,
      entry.priority,
    ]);
    if (signatures.has(signature)) duplicateCount += 1;
    else {
      signatures.add(signature);
      unique.push(entry);
    }
  });
  return {
    entries: unique,
    errors,
    duplicateCount,
    conflicts: detectGlossaryConflicts(unique),
    detectedLayout,
  };
}

export function parseGlossaryCsv(
  text: string,
  options: GlossaryTableOptions = {},
): GlossaryImportResult {
  const rows = parseCsvRows(text);
  return parseGlossaryRows(rows, options);
}

interface GlossaryTableOptions {
  direction?: "zh-CN_zh-TW" | "zh-CN_en" | "auto";
  sheetName?: string;
}

function cellText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function inferColumnPair(
  rows: unknown[][],
  direction: GlossaryTableOptions["direction"],
): { source: number; target: number } | null {
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  let best: { source: number; target: number; score: number } | null = null;
  for (let source = 0; source < columnCount; source += 1) {
    for (let target = 0; target < columnCount; target += 1) {
      if (source === target) continue;
      let pairCount = 0;
      let languageFit = 0;
      rows.slice(0, 80).forEach((row) => {
        const from = cellText(row[source]);
        const to = cellText(row[target]);
        if (!from || !to || from === to || !/[\p{Script=Han}]/u.test(from))
          return;
        pairCount += 1;
        if (direction === "zh-CN_en") {
          if (/[A-Za-z]/.test(to)) languageFit += 2;
        } else if (/[\p{Script=Han}]/u.test(to)) languageFit += 1;
      });
      const score = pairCount * 4 + languageFit - Math.abs(target - source);
      if (pairCount >= 2 && (!best || score > best.score))
        best = { source, target, score };
    }
  }
  return best ? { source: best.source, target: best.target } : null;
}

export function parseGlossaryRows(
  rows: unknown[][],
  options: GlossaryTableOptions = {},
): GlossaryImportResult {
  if (rows.length === 0)
    return {
      entries: [],
      errors: [{ line: 1, reason: "表格为空或缺少表头" }],
      duplicateCount: 0,
      conflicts: [],
    };
  let headerRow = rows.slice(0, 12).findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return (
      normalized.includes("source_term") && normalized.includes("target_term")
    );
  });
  let headers: Array<GlossaryHeader | undefined>;
  let detectedLayout: string;
  if (headerRow >= 0) {
    headers = rows[headerRow].map(normalizeHeader);
    const sourceColumn = headers.indexOf("source_term");
    const targetColumn = headers.indexOf("target_term");
    detectedLayout = `已自动识别${options.sheetName ? `“${options.sheetName}”中的` : ""}第 ${headerRow + 1} 行表头：第 ${sourceColumn + 1} 列为来源词，第 ${targetColumn + 1} 列为目标词`;
  } else {
    const inferred = inferColumnPair(rows, options.direction ?? "auto");
    if (!inferred)
      return {
        entries: [],
        errors: [
          {
            line: 1,
            reason: "没有找到可组成对照关系的两列文本",
          },
        ],
        duplicateCount: 0,
        conflicts: [],
      };
    headers = Array.from(
      { length: Math.max(inferred.source, inferred.target) + 1 },
      () => undefined,
    );
    headers[inferred.source] = "source_term";
    headers[inferred.target] = "target_term";
    const firstRowLooksLikeHeader = rows[0].some((cell) =>
      /词|术语|術語|翻译|翻譯|原文|中文|英文|繁体|繁體|简体|簡體|用语|用語|表达|表達|列|source|target|column/i.test(
        cellText(cell),
      ),
    );
    headerRow = firstRowLooksLikeHeader ? 0 : -1;
    detectedLayout = `已根据内容自动推断：第 ${inferred.source + 1} 列为来源词，第 ${inferred.target + 1} 列为目标词`;
  }
  const entries: GlossaryEntry[] = [];
  const errors: GlossaryImportError[] = [];
  rows.slice(headerRow + 1).forEach((row, index) => {
    const raw: RawGlossaryEntry = {};
    headers.forEach((header, column) => {
      if (header) raw[header as keyof RawGlossaryEntry] = row[column] ?? "";
    });
    if (!cellText(raw.source_term) && !cellText(raw.target_term)) return;
    if (!raw.action) raw.action = "replace";
    const result = validateEntry(raw, index + headerRow + 2);
    if (result.entry) entries.push(result.entry);
    if (result.error) errors.push(result.error);
  });
  return finalize(entries, errors, detectedLayout);
}

export function parseGlossaryJson(text: string): GlossaryImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return {
      entries: [],
      errors: [{ line: 1, reason: "JSON 格式无效" }],
      duplicateCount: 0,
      conflicts: [],
    };
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { entries?: unknown }).entries)
      ? (parsed as { entries: unknown[] }).entries
      : null;
  if (!rows)
    return {
      entries: [],
      errors: [{ line: 1, reason: "JSON 顶层必须是数组或包含 entries 数组" }],
      duplicateCount: 0,
      conflicts: [],
    };
  const entries: GlossaryEntry[] = [];
  const errors: GlossaryImportError[] = [];
  rows.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      errors.push({ line: index + 1, reason: "条目必须是对象" });
      return;
    }
    const result = validateEntry(raw as RawGlossaryEntry, index + 1);
    if (result.entry) entries.push(result.entry);
    if (result.error) errors.push(result.error);
  });
  return finalize(entries, errors);
}

export function parseGlossary(
  text: string,
  fileName: string,
  direction: GlossaryTableOptions["direction"] = "auto",
): GlossaryImportResult {
  if (fileName.toLowerCase().endsWith(".csv"))
    return parseGlossaryCsv(text, { direction });
  if (fileName.toLowerCase().endsWith(".json")) return parseGlossaryJson(text);
  return {
    entries: [],
    errors: [{ line: 1, reason: "仅支持 UTF-8 CSV 或 JSON 术语表" }],
    duplicateCount: 0,
    conflicts: [],
  };
}

export function validateGlossaryEntry(
  entry: Omit<GlossaryEntry, "id" | "source">,
): string | null {
  return (
    validateEntry(
      {
        source_term: entry.sourceTerm,
        target_term: entry.targetTerm,
        action: entry.action,
        note: entry.note,
        enabled: entry.enabled,
        priority: entry.priority,
      },
      1,
    ).error?.reason ?? null
  );
}
