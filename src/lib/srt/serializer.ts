import type { SubtitleEntry } from "../../types";

export function serializeSrt(entries: SubtitleEntry[]): string {
  return serializeSrtWithLineEnding(entries, "\r\n");
}

export function serializeSrtWithLineEnding(
  entries: SubtitleEntry[],
  lineEnding: "\n" | "\r\n",
): string {
  const blocks = entries.map((entry) => {
    const text = entry.workingText
      .replace(/\r\n?/g, "\n")
      .replace(/\n/g, lineEnding);
    return [entry.sequenceRaw, entry.timecodeRaw, text].join(lineEnding);
  });
  return `${blocks.join(`${lineEnding}${lineEnding}`)}${lineEnding}`;
}

export function toUtf8Blob(entries: SubtitleEntry[]): Blob {
  return new Blob([serializeSrt(entries)], {
    type: "application/x-subrip;charset=utf-8",
  });
}
