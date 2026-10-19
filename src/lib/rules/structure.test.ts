import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSrt } from "../srt/parser";
import { checkStructure } from "./structure";
import { DEFAULT_RULES } from "../../types";

const fixture = (name: string) =>
  readFileSync(resolve(process.cwd(), "samples", name), "utf8");

describe("structure rules", () => {
  it("detects malformed sequences, equal timecodes, empty text, and overlap", () => {
    const entries = parseSrt(fixture("structural-issues.srt")).entries;
    const issues = checkStructure(entries, DEFAULT_RULES);
    expect(
      issues.some(
        (issue) =>
          issue.ruleId === "checkSequence" && issue.message.includes("重复"),
      ),
    ).toBe(true);
    expect(
      issues.some(
        (issue) =>
          issue.ruleId === "checkTimecode" &&
          issue.message.includes("开始时间"),
      ),
    ).toBe(true);
    expect(issues.some((issue) => issue.ruleId === "checkEmptySubtitle")).toBe(
      true,
    );
    expect(
      issues.some(
        (issue) =>
          issue.ruleId === "checkOverlap" && issue.message.includes("400 毫秒"),
      ),
    ).toBe(true);
  });

  it("does not report exact adjacency as overlap", () => {
    const entries = parseSrt(
      "1\n00:00:01,000 --> 00:00:02,000\nOne\n\n2\n00:00:02,000 --> 00:00:03,000\nTwo",
    ).entries;
    expect(
      checkStructure(entries, DEFAULT_RULES).filter(
        (issue) => issue.ruleId === "checkOverlap",
      ),
    ).toHaveLength(0);
  });

  it("detects text containing only whitespace as empty", () => {
    const entries = parseSrt("1\n00:00:01,000 --> 00:00:02,000\n  \t").entries;
    expect(
      checkStructure(entries, DEFAULT_RULES).some(
        (issue) => issue.ruleId === "checkEmptySubtitle",
      ),
    ).toBe(true);
  });
});
