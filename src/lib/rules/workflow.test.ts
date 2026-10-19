import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSrt } from "../srt/parser";
import { serializeSrt } from "../srt/serializer";
import { runChecks } from "./checker";
import { DEFAULT_RULES, type RulesConfig } from "../../types";

const fixture = (name: string) =>
  readFileSync(resolve(process.cwd(), "samples", name), "utf8");
const allRules: RulesConfig = {
  ...DEFAULT_RULES,
  removeTrailingPunctuation: true,
  capitalizeEnglishStart: true,
  normalizeWhitespace: true,
};

describe("review workflow", () => {
  it("matches the expected output after all content rules are accepted in required order", () => {
    const entries = parseSrt(fixture("content-issues.srt")).entries.map(
      (entry) => ({ ...entry }),
    );
    for (const entry of entries) {
      let current = entry.workingText;
      for (const ruleId of [
        "normalizeWhitespace",
        "capitalizeEnglishStart",
        "removeTrailingPunctuation",
      ] as const) {
        const issue = runChecks([{ ...entry, workingText: current }], {
          ...DEFAULT_RULES,
          [ruleId]: true,
        }).find((candidate) => candidate.ruleId === ruleId);
        if (issue?.suggestedValue !== undefined) current = issue.suggestedValue;
      }
      entry.workingText = current;
    }
    expect(serializeSrt(entries).replace(/\r\n/g, "\n").trimEnd()).toBe(
      fixture("content-expected-all-accepted.srt").trimEnd(),
    );
  });

  it("exports accepted and manual edits while ignored and pending suggestions retain current text", () => {
    const entries = parseSrt(fixture("content-issues.srt")).entries;
    entries[0] = { ...entries[0], workingText: "Smart inspection works" };
    entries[1] = { ...entries[1], workingText: "Manual subtitle" };
    const output = serializeSrt(entries);
    expect(output).toContain("Smart inspection works\r\n");
    expect(output).toContain("Manual subtitle\r\n");
    expect(output).toContain("“welcome to the platform。”");
    expect(output).toContain("Line one  \r\nLine two?");
  });

  it("keeps an ignored finding ignored on an unchanged rerun", () => {
    const entries = parseSrt(
      "1\n00:00:01,000 --> 00:00:02,000\nhello.",
    ).entries;
    const initial = runChecks(entries, allRules);
    const ignored = initial.map((issue) =>
      issue.ruleId === "capitalizeEnglishStart"
        ? { ...issue, status: "ignored" as const }
        : issue,
    );
    const rerun = runChecks(entries, allRules, ignored);
    expect(
      rerun.find((issue) => issue.ruleId === "capitalizeEnglishStart")?.status,
    ).toBe("ignored");
  });
});
