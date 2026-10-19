// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseGlossaryHtml } from "./word-glossary-adapter";

describe("Word glossary adapter", () => {
  it("recognizes an ordinary two-column Word table", () => {
    const result = parseGlossaryHtml(
      `<table>
        <tr><th>中文列</th><th>翻译中文列</th></tr>
        <tr><td>軟件</td><td>軟體</td></tr>
        <tr><td>服務器</td><td>伺服器</td></tr>
      </table>`,
      "zh-CN_zh-TW",
    );
    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(2);
    expect(result.detectedLayout).toContain("Word");
  });

  it("recognizes source-to-target paragraphs", () => {
    const result = parseGlossaryHtml(
      `<p>设备运行数据 → equipment operating data</p>
       <p>工单：work order</p>`,
      "zh-CN_en",
    );
    expect(result.errors).toHaveLength(0);
    expect(result.entries.map((entry) => entry.targetTerm)).toEqual([
      "equipment operating data",
      "work order",
    ]);
  });
});
