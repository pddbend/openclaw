import { describe, it, expect } from "vitest";
import { calculateResponseRepetition, type AgentResponse } from "../../../../src/agents/adaptive-compaction/signals/response-repetition.js";

describe("calculateResponseRepetition", () => {
	it("returns 1.0 (perfect quality) for empty or single response", () => {
		expect(calculateResponseRepetition({ responses: [] }).value).toBe(1.0);
		expect(calculateResponseRepetition({ responses: [{ id: "1", content: "Hello" }] }).value).toBe(1.0);
	});

	it("returns high quality for diverse responses", () => {
		const responses: AgentResponse[] = [
			{ id: "1", content: "I'll add the user authentication module first." },
			{ id: "2", content: "Now let me set up the database connection." },
			{ id: "3", content: "Finally, I'll write tests for the API endpoints." },
		];
		const result = calculateResponseRepetition({ responses });
		// Low repetition = high quality
		expect(result.value).toBeGreaterThan(0.7);
	});

	it("returns low quality for repeated responses", () => {
		const responses: AgentResponse[] = [
			{ id: "1", content: "I'll implement the feature using TypeScript. TypeScript provides type safety." },
			{ id: "2", content: "I'll implement the feature using TypeScript. TypeScript provides type safety." },
		];
		const result = calculateResponseRepetition({ responses });
		// High repetition = low quality
		expect(result.value).toBeLessThan(0.5);
	});

	it("detects partial repetition correctly", () => {
		const responses: AgentResponse[] = [
			{ id: "1", content: "Let me add a new file called auth.ts. This file will contain the authentication logic." },
			{ id: "2", content: "Let me add a new file called user.ts. This file will contain the user model." },
		];
		const result = calculateResponseRepetition({ responses });
		// Partial overlap in structure, but different content
		expect(result.value).toBeGreaterThanOrEqual(0.5);
		expect(result.value).toBeLessThan(0.95);
	});

	it("uses BLEU-4 scoring correctly", () => {
		// This tests the quality_from_repetition = 1.0 - self_repetition formula
		const responses: AgentResponse[] = [
			{ id: "1", content: "The quick brown fox jumps over the lazy dog repeatedly" },
			{ id: "2", content: "The quick brown fox jumps over the lazy dog again" },
		];
		const result = calculateResponseRepetition({ responses });
		// Significant n-gram overlap
		expect(result.value).toBeLessThan(0.8);
		expect(result.metadata?.maxBleuScore).toBeDefined();
	});
});