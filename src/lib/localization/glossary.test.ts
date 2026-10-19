import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseGlossaryCsv,
  parseGlossaryJson,
  parseGlossaryRows,
  validateGlossaryEntry,
} from "./glossary";

const fixture = (name: string) =>
  readFileSync(resolve(process.cwd(), "glossary", name), "utf8");

describe("glossary parsing", () => {
  it("parses the CSV example with all four actions and disabled entries", () => {
    const result = parseGlossaryCsv(fixture("example-glossary.csv"));
    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(10);
    expect(new Set(result.entries.map((entry) => entry.action))).toEqual(
      new Set(["replace", "suggest", "protect", "warn"]),
    );
    expect(
      result.entries.find((entry) => entry.sourceTerm === "视频")?.enabled,
    ).toBe(false);
  });

  it("parses an equivalent JSON wrapper", () => {
    const result = parseGlossaryJson(fixture("example-glossary.json"));
    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(10);
    expect(
      result.entries.find((entry) => entry.sourceTerm === "报警信息")
        ?.targetTerm,
    ).toBe("告警資訊");
  });

  it("reports invalid rows, deduplicates exact entries, and detects conflicts", () => {
    const result = parseGlossaryCsv(fixture("invalid-glossary.csv"));
    expect(result.errors).toHaveLength(4);
    expect(result.duplicateCount).toBe(1);
    expect(
      result.entries.some((entry) => entry.sourceTerm === "报警信息"),
    ).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      sourceTerm: "工单",
      priority: 80,
    });
    expect(result.conflicts[0].targetTerms).toEqual(["事件工單", "維修單"]);
  });

  it("validates entries created in the UI", () => {
    expect(
      validateGlossaryEntry({
        sourceTerm: "后台",
        targetTerm: "",
        action: "replace",
        enabled: true,
        priority: 50,
      }),
    ).toContain("target_term");
    expect(
      validateGlossaryEntry({
        sourceTerm: "后台",
        targetTerm: "管理平台",
        action: "replace",
        enabled: true,
        priority: 101,
      }),
    ).toContain("0–100");
  });

  it("accepts a bilingual Excel-style comparison table with Chinese headers", () => {
    const result = parseGlossaryRows([
      ["中文术语", "英文术语", "备注", "优先级"],
      ["设备运行数据", "equipment operating data", "产品术语", 90],
      ["工单", "work order", "", 80],
    ]);
    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      sourceTerm: "设备运行数据",
      targetTerm: "equipment operating data",
      action: "replace",
      priority: 90,
    });
  });

  it("recognizes the supplied Taiwan mapping workbook headers without a template", () => {
    const result = parseGlossaryRows(
      [
        ["中文列", "翻译中文列"],
        ["數字化", "數位化"],
        ["軟件", "軟體"],
      ],
      { direction: "zh-CN_zh-TW", sheetName: "Sheet1" },
    );
    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[1]).toMatchObject({
      sourceTerm: "軟件",
      targetTerm: "軟體",
      action: "replace",
    });
    expect(result.detectedLayout).toContain("Sheet1");
  });

  it("infers a two-column comparison when the headers are unfamiliar", () => {
    const result = parseGlossaryRows(
      [
        ["甲方表达", "交付表达"],
        ["设备运行数据", "equipment operating data"],
        ["工单", "work order"],
      ],
      { direction: "zh-CN_en" },
    );
    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].targetTerm).toBe("equipment operating data");
    expect(result.detectedLayout).toContain("自动推断");
  });
});
