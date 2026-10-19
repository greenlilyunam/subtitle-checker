import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSrt } from "../srt/parser";
import { serializeSrtWithLineEnding } from "../srt/serializer";
import {
  DEFAULT_LOCALIZATION_RULES,
  type GlossaryEntry,
} from "../../types/localization";
import { parseGlossaryCsv } from "./glossary";
import {
  localizationOutputText,
  localizeText,
  runLocalization,
} from "./engine";

const sample = (name: string) =>
  readFileSync(resolve(process.cwd(), "samples", name), "utf8");
const glossary = (name: string) =>
  readFileSync(resolve(process.cwd(), "glossary", name), "utf8");

function acceptAll(inputName: string, entriesGlossary: GlossaryEntry[] = []) {
  const parsed = parseSrt(sample(inputName));
  const issues = runLocalization(
    parsed.entries,
    DEFAULT_LOCALIZATION_RULES,
    entriesGlossary,
  );
  const accepted = issues.map((issue) => ({
    ...issue,
    status: "accepted" as const,
  }));
  const byEntry = new Map(accepted.map((issue) => [issue.entryId, issue]));
  const outputEntries = parsed.entries.map((entry) => ({
    ...entry,
    workingText:
      localizationOutputText(byEntry.get(entry.id)) ?? entry.originalText,
  }));
  return {
    parsed,
    issues,
    output: serializeSrtWithLineEnding(outputEntries, parsed.lineEnding),
  };
}

describe("localization engine", () => {
  it("matches the complete default expected SRT", () => {
    const result = acceptAll("localization-input.srt");
    expect(result.issues).toHaveLength(14);
    expect(result.output.trimEnd()).toBe(
      sample("localization-expected-default.srt").trimEnd(),
    );
  });

  it("lets custom terms override built-ins with longest phrases first", () => {
    const custom = parseGlossaryCsv(glossary("example-glossary.csv")).entries;
    const result = acceptAll("localization-input.srt", custom);
    expect(result.output.trimEnd()).toBe(
      sample("localization-expected-custom-glossary.srt").trimEnd(),
    );
    expect(result.output).toContain("思倍云 SmartInspect V2.1");
    expect(result.output).toContain("影像監控");
    expect(result.output).not.toContain("影片監控");
  });

  it("matches traditional mainland glossary sources against simplified subtitles", () => {
    const result = localizeText(
      "软件连接服务器。",
      DEFAULT_LOCALIZATION_RULES,
      [
        {
          id: "workbook-software",
          sourceTerm: "軟件",
          targetTerm: "軟體",
          action: "replace",
          enabled: true,
          priority: 80,
          source: "custom",
        },
      ],
    );
    expect(result?.suggestedText).toContain("軟體");
    expect(
      result?.changes.some((change) => change.source === "custom-glossary"),
    ).toBe(true);
  });

  it("marks equal-priority different targets as a high-risk conflict without replacing", () => {
    const custom = parseGlossaryCsv(glossary("invalid-glossary.csv")).entries;
    const entries = parseSrt(sample("glossary-conflict-input.srt")).entries;
    const issues = runLocalization(entries, DEFAULT_LOCALIZATION_RULES, custom);
    expect(issues[0].hasConflict).toBe(true);
    expect(issues[0].risk).toBe("high");
    expect(issues[0].suggestedText).toContain("工单");
    expect(
      issues[0].changes.find((change) => change.type === "conflict")
        ?.conflictTargets,
    ).toEqual(["事件工單", "維修單"]);
    expect(issues[1].suggestedText).toContain("告警資訊");
  });

  it("applies context exceptions without producing mechanical wrong terms", () => {
    const entries = parseSrt(sample("ambiguous-expressions.srt")).entries;
    const issues = runLocalization(entries, DEFAULT_LOCALIZATION_RULES, []);
    expect(issues[0].suggestedText).toContain("視訊會議");
    expect(issues[0].suggestedText).not.toContain("影片會議");
    expect(issues[1].suggestedText).toContain("物理連接");
    expect(issues[1].suggestedText).not.toContain("物理連線");
  });

  it("preserves multi-line positions and source structure", () => {
    const result = acceptAll("localization-input.srt");
    const before = result.parsed.entries;
    const after = parseSrt(result.output).entries;
    expect(after).toHaveLength(before.length);
    expect(after.map((entry) => entry.sequenceRaw)).toEqual(
      before.map((entry) => entry.sequenceRaw),
    );
    expect(after.map((entry) => entry.timecodeRaw)).toEqual(
      before.map((entry) => entry.timecodeRaw),
    );
    expect(after[13].workingText.split("\n")).toHaveLength(
      before[13].workingText.split("\n").length,
    );
  });

  it("is idempotent for the expected Taiwan Traditional output", () => {
    const entries = parseSrt(
      sample("localization-expected-default.srt"),
    ).entries;
    expect(
      runLocalization(entries, DEFAULT_LOCALIZATION_RULES, []),
    ).toHaveLength(0);
    const already = parseSrt(sample("already-zh-tw.srt")).entries;
    expect(
      runLocalization(already, DEFAULT_LOCALIZATION_RULES, []),
    ).toHaveLength(0);
  });

  it("keeps export semantics separate for accepted, ignored, edited, and pending", () => {
    const base = localizeText("请打开软件。", DEFAULT_LOCALIZATION_RULES, []);
    expect(base).not.toBeNull();
    const issue = {
      ...base!,
      id: "i",
      entryId: "e",
      fingerprint: "f",
      status: "pending" as const,
    };
    expect(localizationOutputText(issue)).toBe("请打开软件。");
    expect(localizationOutputText({ ...issue, status: "ignored" })).toBe(
      "请打开软件。",
    );
    expect(localizationOutputText({ ...issue, status: "accepted" })).toBe(
      "請開啟軟體。",
    );
    expect(
      localizationOutputText({
        ...issue,
        status: "edited",
        editedText: "人工內容。",
      }),
    ).toBe("人工內容。");
  });
});
