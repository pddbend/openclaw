import { describe, it, expect } from "vitest";
import { collectSignals, type SignalCollectionInput } from "../../../../src/agents/adaptive-compaction/signals/index.js";

describe("collectSignals", () => {
	it("returns all 5 signals", () => {
		const input: SignalCollectionInput = {
			blocks: [
				{ id: "1", content: "Test block", offset: 0, length: 10, isKeyInfo: true, isOutdated: false, similarity: 0.9 },
			],
			totalContextLength: 100,
			userTurns: [{ id: "1", content: "Test turn" }],
			agentResponses: [{ id: "1", content: "Test response" }],
			activeTaskQuery: "test query",
			contextWindow: 1000,
			currentTokens: 500,
			turnNumber: 1,
		};

		const result = collectSignals(input);

		expect(result.measurements).toHaveLength(5);
		expect(result.measurements.map((m) => m.type)).toContain("distractor_density");
		expect(result.measurements.map((m) => m.type)).toContain("semantic_confusion");
		expect(result.measurements.map((m) => m.type)).toContain("positional_risk");
		expect(result.measurements.map((m) => m.type)).toContain("user_correction");
		expect(result.measurements.map((m) => m.type)).toContain("response_repetition");
		expect(result.rawUsage).toBe(0.5);
	});

	it("calculates raw usage correctly", () => {
		const input: SignalCollectionInput = {
			blocks: [],
			totalContextLength: 1000,
			userTurns: [],
			agentResponses: [],
			activeTaskQuery: "test",
			contextWindow: 2000,
			currentTokens: 1000,
			turnNumber: 1,
		};

		const result = collectSignals(input);
		expect(result.rawUsage).toBe(0.5);
	});
});