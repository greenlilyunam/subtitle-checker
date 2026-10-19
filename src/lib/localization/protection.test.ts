import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "../../types/localization";
import { protectText } from "./protection";
import { convertToTaiwanTraditional } from "./opencc-adapter";

const protectedBrand: GlossaryEntry = {
  id: "brand",
  sourceTerm: "思倍云",
  targetTerm: "",
  action: "protect",
  note: "品牌",
  enabled: true,
  priority: 100,
  source: "custom",
};

describe("protected fragments", () => {
  it("restores custom brands, URLs, emails, versions, models, and tags exactly", () => {
    const input =
      "思倍云 SmartInspect V2.1 https://example.com/a?x=1 ops@example.com RTX 4090 IPC-302A <i>设备</i>";
    const protectedText = protectText(input, [protectedBrand], true);
    const converted = convertToTaiwanTraditional(protectedText.text);
    expect(protectedText.context.restore(converted)).toBe(
      "思倍云 SmartInspect V2.1 https://example.com/a?x=1 ops@example.com RTX 4090 IPC-302A <i>設備</i>",
    );
  });
});
