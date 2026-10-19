import type { ReviewSnapshot } from "../../types";

export function pushUndo(
  stack: ReviewSnapshot[],
  snapshot: ReviewSnapshot,
  limit = 50,
): ReviewSnapshot[] {
  return [...stack, structuredClone(snapshot)].slice(-limit);
}

export function popUndo(stack: ReviewSnapshot[]): {
  snapshot: ReviewSnapshot | null;
  stack: ReviewSnapshot[];
} {
  if (stack.length === 0) return { snapshot: null, stack };
  return {
    snapshot: structuredClone(stack[stack.length - 1]),
    stack: stack.slice(0, -1),
  };
}
