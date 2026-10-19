import { describe, expect, it } from "vitest";
import {
  applyEnabledContentRules,
  capitalizeEnglishStart,
  normalizeWhitespace,
  removeTrailingPunctuation,
} from "./content";

describe("content rules", () => {
  it("removes repeated English and Chinese trailing punctuation", () => {
    expect(removeTrailingPunctuation("Wait...")).toBe("Wait");
    expect(removeTrailingPunctuation("欢迎使用。")).toBe("欢迎使用");
    expect(removeTrailingPunctuation("第一步：检查，第二步：确认！")).toBe(
      "第一步：检查，第二步：确认",
    );
  });

  it("removes punctuation before closing quotes and brackets", () => {
    expect(removeTrailingPunctuation("“欢迎使用。”")).toBe("“欢迎使用”");
    expect(removeTrailingPunctuation("Ready?!】")).toBe("Ready】");
  });

  it("capitalizes only an English sentence start", () => {
    expect(capitalizeEnglishStart("access control")).toBe("Access control");
    expect(capitalizeEnglishStart("“welcome”")).toBe("“Welcome”");
    expect(capitalizeEnglishStart("2026 smart inspection")).toBe(
      "2026 Smart inspection",
    );
    expect(capitalizeEnglishStart("AI inspection")).toBe("AI inspection");
    expect(capitalizeEnglishStart("系统已启动 smart inspection")).toBe(
      "系统已启动 smart inspection",
    );
  });

  it("normalizes ASCII whitespace per line while preserving line breaks and full-width spaces", () => {
    expect(normalizeWhitespace("  Smart\t  inspection  \nLine two  ")).toBe(
      "Smart inspection\nLine two",
    );
    expect(normalizeWhitespace("　保留全角空格　")).toBe("　保留全角空格　");
  });

  it("applies combined rules in whitespace, capitalization, punctuation order", () => {
    expect(
      applyEnabledContentRules("  welcome  home!  ", [
        "removeTrailingPunctuation",
        "capitalizeEnglishStart",
        "normalizeWhitespace",
      ]),
    ).toBe("Welcome home");
  });
});
