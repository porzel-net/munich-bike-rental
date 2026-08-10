import { describe, expect, it } from "vitest";

import { analyzeEmailThread } from "../../lib/inquiries/email-action";
import { emailActionEvaluationCases } from "../fixtures/email-action-evaluation";

const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

describe.skipIf(!hasApiKey)("live email action evaluation", () => {
  it("classifies all twenty open and twenty closed examples correctly", async () => {
    const results = [];
    for (const item of emailActionEvaluationCases) {
      const result = await analyzeEmailThread(item.messages);
      results.push({ name: item.name, expected: item.expectedNeedsAction, actual: result.review.needs_action });
    }
    expect(results.filter((item) => item.expected && item.actual)).toHaveLength(20);
    expect(results.filter((item) => !item.expected && !item.actual)).toHaveLength(20);
    expect(results.filter((item) => item.expected !== item.actual)).toEqual([]);
  }, 180_000);
});
