import type {
  CheckConclusion,
  CheckRollup,
  ReviewState,
} from "@/modules/github-insights/application/queries/read-models";

import type { Tone } from "./chip";

/** Waiting on you or blocked reads as attention; settled reads as healthy. */
export function reviewTone(state: ReviewState): Tone {
  switch (state) {
    case "your-review":
    case "changes-requested":
      return "attention";
    case "approved":
      return "healthy";
    default:
      return "neutral";
  }
}

/** Colour is never the only carrier: the words say "passed" and "failed" too. */
export function rollupClass(rollup: CheckRollup): string {
  switch (rollup) {
    case "passed":
      return "text-pr";
    case "failed":
      return "text-issue";
    case "running":
      return "text-running";
    default:
      return "text-ink-faint";
  }
}

export function conclusionClass(conclusion: CheckConclusion): string {
  switch (conclusion) {
    case "passed":
      return "text-pr";
    case "failed":
      return "text-issue";
    case "running":
      return "text-running";
    default:
      return "text-ink-faint";
  }
}

/** The prototype's label vocabulary, kept as it was drawn. */
export function labelTone(label: string | null): Tone {
  if (!label) return "neutral";
  if (["bug", "perf", "regression"].includes(label)) return "attention";
  if (["architecture", "enhancement"].includes(label)) return "healthy";
  return "neutral";
}
