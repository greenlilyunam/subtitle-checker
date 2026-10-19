import type {
  GlossaryEntry,
  GlossaryImportResult,
  LocalizationDirection,
} from "../../types/localization";
import { detectGlossaryConflicts, parseGlossaryRows } from "./glossary";

function signature(entry: GlossaryEntry): string {
  return JSON.stringify([
    entry.sourceTerm,
    entry.targetTerm,
    entry.action,
    entry.enabled,
    entry.priority,
  ]);
}

/** Parses Mammoth's inert HTML output without inserting it into the page. */
export function parseGlossaryHtml(
  html: string,
  direction: LocalizationDirection,
): GlossaryImportResult {
  const document = new DOMParser().parseFromString(html, "text/html");
  const candidates: GlossaryImportResult[] = [];

  document.querySelectorAll("table").forEach((table, index) => {
    const rows = [...table.querySelectorAll("tr")].map((row) =>
      [...row.querySelectorAll("th,td")].map(
        (cell) => cell.textContent?.trim() ?? "",
      ),
    );
    if (rows.length > 0)
      candidates.push(
        parseGlossaryRows(rows, {
          direction,
          sheetName: `Word 表格 ${index + 1}`,
        }),
      );
  });

  const paragraphPairs = [...document.querySelectorAll("p")]
    .filter((paragraph) => !paragraph.closest("table"))
    .flatMap((paragraph) => {
      const text = paragraph.textContent?.trim() ?? "";
      const match = /^(.+?)\s*(?:→|=>|\t|={1,2}|：|:)\s*(.+)$/.exec(text);
      return match ? [[match[1].trim(), match[2].trim()]] : [];
    });
  if (paragraphPairs.length > 0)
    candidates.push(
      parseGlossaryRows([["source_term", "target_term"], ...paragraphPairs], {
        direction,
        sheetName: "Word 段落",
      }),
    );

  const entries: GlossaryEntry[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;
  candidates.forEach((candidate) =>
    candidate.entries.forEach((entry) => {
      const key = signature(entry);
      if (seen.has(key)) duplicateCount += 1;
      else {
        seen.add(key);
        entries.push(entry);
      }
    }),
  );
  if (entries.length === 0)
    return {
      entries: [],
      errors: [
        {
          line: 1,
          reason: "Word 中没有识别到双列表格或“来源词 → 目标词”段落",
        },
      ],
      duplicateCount: 0,
      conflicts: [],
    };
  return {
    entries,
    errors: [],
    duplicateCount,
    conflicts: detectGlossaryConflicts(entries),
    detectedLayout: `已自动识别 Word 中的 ${candidates.length} 组对照内容`,
  };
}

/** Reads tables and simple `source → target` paragraphs from a local DOCX file. */
export async function parseGlossaryWord(
  file: File,
  direction: LocalizationDirection,
): Promise<GlossaryImportResult> {
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return {
      entries: [],
      errors: [
        {
          line: 1,
          reason: "旧版 .doc 暂时无法在浏览器安全读取，请另存为 .docx 后再上传",
        },
      ],
      duplicateCount: 0,
      conflicts: [],
    };
  }

  try {
    const mammoth = (await import("mammoth")).default;
    const converted = await mammoth.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    return parseGlossaryHtml(converted.value, direction);
  } catch {
    return {
      entries: [],
      errors: [{ line: 1, reason: "无法读取该 Word 文件，请确认文件未损坏" }],
      duplicateCount: 0,
      conflicts: [],
    };
  }
}
