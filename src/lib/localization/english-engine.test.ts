import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "../../types/localization";
import { parseSrt } from "../srt/parser";
import {
  runEnglishLocalization,
  translateWithEnglishGlossary,
} from "./english-engine";

const terms: GlossaryEntry[] = [
  {
    id: "1",
    sourceTerm: "设备运行数据",
    targetTerm: "equipment operating data",
    action: "replace",
    enabled: true,
    priority: 90,
    source: "custom",
  },
  {
    id: "2",
    sourceTerm: "工单",
    targetTerm: "work order",
    action: "replace",
    enabled: true,
    priority: 80,
    source: "custom",
  },
];

describe("Chinese to English glossary workflow", () => {
  it("uses a complete sentence mapping as a low-risk suggestion", () => {
    const result = translateWithEnglishGlossary("请打开软件。", [
      {
        ...terms[0],
        sourceTerm: "请打开软件。",
        targetTerm: "Please open the software.",
      },
    ]);
    expect(result?.suggestedText).toBe("Please open the software.");
    expect(result?.risk).toBe("low");
  });

  it("applies longest terms and flags uncovered Chinese for manual translation", () => {
    const result = translateWithEnglishGlossary(
      "查看设备运行数据并创建工单。",
      terms,
    );
    expect(result?.suggestedText).toContain("equipment operating data");
    expect(result?.suggestedText).toContain("work order");
    expect(result?.risk).toBe("high");
    expect(
      result?.changes.some((change) => change.id === "en-untranslated-content"),
    ).toBe(true);
  });

  it("creates a manual-review card for each untranslated Chinese subtitle", () => {
    const entries = parseSrt(
      "1\n00:00:00,000 --> 00:00:02,000\n这是一条中文字幕。\n",
    ).entries;
    const issues = runEnglishLocalization(entries, []);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ risk: "high", status: "pending" });
  });

  it("keeps URLs, email addresses and versions unchanged", () => {
    const result = translateWithEnglishGlossary(
      "访问 https://example.com 并联系 ops@example.com，版本 V2.1。",
      [],
    );
    expect(result?.suggestedText).toContain("https://example.com");
    expect(result?.suggestedText).toContain("ops@example.com");
    expect(result?.suggestedText).toContain("V2.1");
  });
});
