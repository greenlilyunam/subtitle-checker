import { describe, expect, it } from "vitest";
import { popUndo, pushUndo } from "./stack";
import type { ReviewSnapshot } from "../../types";

describe("transaction undo stack", () => {
  it("restores a batch as one complete transaction", () => {
    const snapshot: ReviewSnapshot = {
      entries: [],
      issues: [],
      selectedIssueIds: ["a", "b"],
      label: "批量接受",
    };
    const stack = pushUndo([], snapshot);
    snapshot.selectedIssueIds.length = 0;
    const result = popUndo(stack);
    expect(result.snapshot?.label).toBe("批量接受");
    expect(result.snapshot?.selectedIssueIds).toEqual(["a", "b"]);
    expect(result.stack).toHaveLength(0);
  });
});
