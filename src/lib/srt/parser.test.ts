import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeUtf8, parseSrt } from "./parser";
import { serializeSrt } from "./serializer";

const fixture = (name: string) =>
  readFileSync(resolve(process.cwd(), "samples", name), "utf8");

describe("SRT parser", () => {
  it("removes an UTF-8 BOM", () => {
    const bytes = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...new TextEncoder().encode("1\n00:00:01,000 --> 00:00:02,000\nHi"),
    ]);
    const text = decodeUtf8(bytes);
    expect(text.startsWith("\uFEFF")).toBe(false);
    expect(parseSrt(text).entries[0].sequenceRaw).toBe("1");
  });

  it("parses LF and CRLF inputs", () => {
    const lf = "1\n00:00:01,000 --> 00:00:02,000\nHello";
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(parseSrt(lf).entries).toHaveLength(1);
    expect(parseSrt(crlf).entries[0].originalText).toBe("Hello");
  });

  it("preserves multi-line subtitle text", () => {
    const parsed = parseSrt(fixture("normal.srt"));
    expect(parsed.entries[3].originalText).toBe("Line one\nLine two");
  });

  it("retains malformed sequence and timecode blocks with errors", () => {
    const parsed = parseSrt(fixture("invalid-format.srt"));
    expect(parsed.entries).toHaveLength(4);
    expect(
      parsed.entries[1].parseErrors.some(
        (error) => error.code === "invalid_sequence",
      ),
    ).toBe(true);
    expect(
      parsed.entries[0].parseErrors.some(
        (error) => error.code === "invalid_timecode",
      ),
    ).toBe(true);
    expect(parsed.entries[3].rawBlock).toContain("Broken timecode block");
  });

  it("detects a start time greater than or equal to end time", () => {
    const parsed = parseSrt("1\n00:00:02,000 --> 00:00:02,000\nSame");
    expect(
      parsed.entries[0].parseErrors.some(
        (error) => error.code === "invalid_time_range",
      ),
    ).toBe(true);
  });

  it("round trips a valid fixture through CRLF serialization", () => {
    const original = parseSrt(fixture("normal.srt"));
    const reparsed = parseSrt(serializeSrt(original.entries));
    expect(
      reparsed.entries.map(({ sequenceRaw, timecodeRaw, workingText }) => ({
        sequenceRaw,
        timecodeRaw,
        workingText,
      })),
    ).toEqual(
      original.entries.map(({ sequenceRaw, timecodeRaw, workingText }) => ({
        sequenceRaw,
        timecodeRaw,
        workingText,
      })),
    );
  });

  it("serializes with CRLF, one blank line, final newline, and no BOM", () => {
    const parsed = parseSrt(
      "1\n00:00:01,000 --> 00:00:02,000\nHello\n\n2\n00:00:02,000 --> 00:00:03,000\nWorld",
    );
    const output = serializeSrt(parsed.entries);
    expect(output.startsWith("\uFEFF")).toBe(false);
    expect(output).toBe(
      "1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n\r\n2\r\n00:00:02,000 --> 00:00:03,000\r\nWorld\r\n",
    );
  });
});
