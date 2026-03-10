import { describe, it, expect } from "vitest";
import { prioritizeForCompression, type PrioritizableBlock } from "../../../../src/agents/adaptive-compaction/compression/prioritizer.js";

describe("prioritizeForCompression", () => {
	it("prioritizes removing confusion pair losers", () => {
		const blocks: PrioritizableBlock[] = [
			{ id: "v1", content: "fetchUser(id: string)", similarity: 0.9, isOutdated: true, isConfusionLoser: true },
			{ id: "v2", content: "fetchUser(id: number)", similarity: 0.9, isOutdated: false, isConfusionLoser: false },
			{ id: "other", content: "helper function", similarity: 0.3, isOutdated: false, isConfusionLoser: false },
		];

		const result = prioritizeForCompression({
			blocks,
			targetTokenSavings: 100,
		});

		// v1 should be delete_first (highest priority to remove)
		expect(result[0].blockId).toBe("v1");
		expect(result[0].priority).toBe("delete_first");
	});

	it("prioritizes distractors over unrelated content", () => {
		const blocks: PrioritizableBlock[] = [
			{ id: "dist", content: "old approach", similarity: 0.8, isOutdated: true },
			{ id: "unrelated", content: "background info", similarity: 0.2, isOutdated: false },
		];

		const result = prioritizeForCompression({
			blocks,
			targetTokenSavings: 100,
		});

		const distPriority = result.find((r) => r.blockId === "dist")!;
		const unrelatedPriority = result.find((r) => r.blockId === "unrelated")!;

		expect(distPriority.priority).toBe("delete_second");
		expect(unrelatedPriority.priority).toBe("keep");
	});

	it("preserves key info blocks strictly", () => {
		const blocks: PrioritizableBlock[] = [
			{ id: "key", content: "active constraint: use TypeScript", similarity: 0.9, isOutdated: false, isKeyInfo: true },
		];

		const result = prioritizeForCompression({
			blocks,
			targetTokenSavings: 100,
		});

		expect(result[0].priority).toBe("preserve_strict");
	});

	it("calculates estimated token savings", () => {
		const blocks: PrioritizableBlock[] = [
			{ id: "block1", content: "a".repeat(400), similarity: 0.5, isOutdated: false }, // ~100 tokens
			{ id: "block2", content: "b".repeat(200), similarity: 0.5, isOutdated: true }, // ~50 tokens
		];

		const result = prioritizeForCompression({
			blocks,
			targetTokenSavings: 100,
		});

		expect(result[0].estimatedTokenSavings).toBeGreaterThan(0);
		result.forEach((r) => {
			expect(r.estimatedTokenSavings).toBeGreaterThan(0);
		});
	});

	it("sorts by priority order", () => {
		const blocks: PrioritizableBlock[] = [
			{ id: "keep1", content: "active code", similarity: 0.5, isOutdated: false },
			{ id: "del1", content: "confusion loser", similarity: 0.9, isOutdated: true, isConfusionLoser: true },
			{ id: "del2", content: "old approach", similarity: 0.8, isOutdated: true },
			{ id: "preserve", content: "key constraint", similarity: 0.9, isOutdated: false, isKeyInfo: true },
		];

		const result = prioritizeForCompression({
			blocks,
			targetTokenSavings: 100,
		});

		// Order should be: delete_first, delete_second, keep, preserve_strict
		expect(result[0].priority).toBe("delete_first");
		expect(result[result.length - 1].priority).toBe("preserve_strict");
	});
});