import { describe, it, expect } from "vitest";
import { calculateDistractorDensity, type DistractionInfo } from "../../../../src/agents/adaptive-compaction/signals/distractor-density.js";

describe("calculateDistractorDensity", () => {
	it("returns 0 for empty context", () => {
		const result = calculateDistractorDensity({
			blocks: [],
			activeTaskQuery: "implement user authentication",
		});
		expect(result.value).toBe(0);
	});

	it("returns 0 when no distractors present", () => {
		const blocks: DistractionInfo[] = [
			{ id: "1", content: "Implement user authentication with JWT tokens", isOutdated: false, similarity: 0.9 },
		];
		const result = calculateDistractorDensity({
			blocks,
			activeTaskQuery: "implement user authentication",
		});
		expect(result.value).toBe(0);
	});

	it("identifies distractors correctly", () => {
		const blocks: DistractionInfo[] = [
			{ id: "1", content: "Implement user authentication with JWT", isOutdated: false, similarity: 0.9 },
			{ id: "2", content: "Old authentication approach using sessions", isOutdated: true, similarity: 0.85 },
			{ id: "3", content: "Abandoned OAuth flow attempt", isOutdated: true, similarity: 0.75 },
		];
		const result = calculateDistractorDensity({
			blocks,
			activeTaskQuery: "implement user authentication",
			similarityThreshold: 0.7,
		});
		// 2 distractors out of 3 blocks = 0.667
		expect(result.value).toBeCloseTo(0.667, 2);
		expect(result.metadata?.distractorCount).toBe(2);
	});

	it("only counts high-similarity blocks as distractors", () => {
		const blocks: DistractionInfo[] = [
			{ id: "1", content: "Implement user authentication", isOutdated: false, similarity: 0.9 },
			{ id: "2", content: "Database schema design", isOutdated: true, similarity: 0.3 }, // Low similarity, not a distractor
			{ id: "3", content: "Old auth approach", isOutdated: true, similarity: 0.8 }, // High similarity, is a distractor
		];
		const result = calculateDistractorDensity({
			blocks,
			activeTaskQuery: "implement user authentication",
			similarityThreshold: 0.7,
		});
		// 1 distractor (high similarity + outdated) out of 3 blocks
		expect(result.value).toBeCloseTo(0.333, 2);
	});
});