import type { ParseError, ParsedSrt, SubtitleEntry } from "../../types";

const TIMECODE_RE =
  /^(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})$/;

export function decodeUtf8(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(view)
      .replace(/^\uFEFF/, "");
  } catch {
    throw new Error("文件不是有效的 UTF-8 编码，请转换编码后重试");
  }
}

export function timecodeToMs(
  hours: string,
  minutes: string,
  seconds: string,
  milliseconds: string,
): number {
  return (
    Number(hours) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000 +
    Number(milliseconds)
  );
}

export function parseTimecode(
  raw: string,
): { startMs: number; endMs: number } | null {
  const match = TIMECODE_RE.exec(raw);
  if (!match) return null;
  const [, sh, sm, ss, sms, eh, em, es, ems] = match;
  if (Number(sm) > 59 || Number(ss) > 59 || Number(em) > 59 || Number(es) > 59)
    return null;
  return {
    startMs: timecodeToMs(sh, sm, ss, sms),
    endMs: timecodeToMs(eh, em, es, ems),
  };
}

function parseBlock(rawBlock: string, order: number): SubtitleEntry {
  const lines = rawBlock.split("\n");
  const sequenceRaw = lines[0] ?? "";
  const timecodeRaw = lines[1] ?? "";
  const originalText = lines.slice(2).join("\n");
  const parseErrors: ParseError[] = [];

  const originalIndex =
    /^\d+$/.test(sequenceRaw) && Number(sequenceRaw) > 0
      ? Number(sequenceRaw)
      : null;
  if (!sequenceRaw) {
    parseErrors.push({ code: "missing_sequence", message: "字幕块缺少序号" });
  } else if (originalIndex === null) {
    parseErrors.push({
      code: "invalid_sequence",
      message: `序号“${sequenceRaw}”不是正整数`,
    });
  }

  const parsedTimecode = parseTimecode(timecodeRaw);
  if (!timecodeRaw) {
    parseErrors.push({ code: "missing_timecode", message: "字幕块缺少时间码" });
  } else if (!parsedTimecode) {
    parseErrors.push({
      code: "invalid_timecode",
      message: `时间码“${timecodeRaw}”格式无效`,
    });
  } else if (parsedTimecode.startMs >= parsedTimecode.endMs) {
    parseErrors.push({
      code: "invalid_time_range",
      message: "开始时间必须早于结束时间",
    });
  }

  return {
    id: `entry-${order + 1}`,
    order,
    originalIndex,
    sequenceRaw,
    timecodeRaw,
    startMs: parsedTimecode?.startMs ?? null,
    endMs: parsedTimecode?.endMs ?? null,
    originalText,
    workingText: originalText,
    rawBlock,
    parseErrors,
  };
}

export function parseSrt(input: string): ParsedSrt {
  const hadBom = input.startsWith("\uFEFF");
  const lineEnding: "\n" | "\r\n" = input.includes("\r\n") ? "\r\n" : "\n";
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (normalized.trim().length === 0) throw new Error("文件中没有可读取的字幕");

  const blocks = normalized
    .replace(/\n+$/, "")
    .split(/\n[ \t]*\n+/)
    .filter((block) => block.length > 0);

  if (blocks.length === 0) throw new Error("文件中没有可读取的字幕");
  return { entries: blocks.map(parseBlock), hadBom, lineEnding };
}

export async function readSrtFile(file: File): Promise<ParsedSrt> {
  if (!file.name.toLowerCase().endsWith(".srt"))
    throw new Error("当前仅支持单个 .srt 文件");
  const text = decodeUtf8(await file.arrayBuffer());
  return parseSrt(text);
}
