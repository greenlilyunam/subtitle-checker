import readWorkbook from "read-excel-file/browser";
import type {
  GlossaryImportResult,
  LocalizationDirection,
} from "../../types/localization";
import { parseGlossaryRows } from "./glossary";

/**
 * Browser-only Excel adapter. The workbook never leaves the current tab.
 * All worksheets are inspected and the table with the most valid mappings wins.
 */
export async function parseGlossaryExcel(
  file: File,
  direction: LocalizationDirection,
): Promise<GlossaryImportResult> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return {
      entries: [],
      errors: [{ line: 1, reason: "Excel 术语表目前仅支持 .xlsx 文件" }],
      duplicateCount: 0,
      conflicts: [],
    };
  }

  try {
    const sheets = await readWorkbook(file);
    const candidates = sheets.map((sheet) =>
      parseGlossaryRows(sheet.data as unknown[][], {
        direction,
        sheetName: sheet.sheet,
      }),
    );
    return (
      candidates.sort(
        (a, b) =>
          b.entries.length - a.entries.length ||
          a.errors.length - b.errors.length,
      )[0] ?? {
        entries: [],
        errors: [{ line: 1, reason: "工作簿中没有可读取的工作表" }],
        duplicateCount: 0,
        conflicts: [],
      }
    );
  } catch {
    return {
      entries: [],
      errors: [{ line: 1, reason: "无法读取该 Excel 文件，请确认文件未损坏" }],
      duplicateCount: 0,
      conflicts: [],
    };
  }
}
