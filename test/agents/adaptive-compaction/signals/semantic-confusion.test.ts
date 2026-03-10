import { describe, it, expect } from "vitest";
import { calculateSemanticConfusion, type BlockComparison } from "../../../../src/agents/adaptive-compaction/signals/semantic-confusion.js";

describe("calculateSemanticConfusion", () => {
	it("returns 0 for empty or single-block context", () => {
		expect(calculateSemanticConfusion({ blocks: [] }).value).toBe(0);
		expect(calculateSemanticConfusion({ blocks: [{ id: "1", content: "test" }] }).value).toBe(0);
	});

	it("detects confusion pairs from similar but conflicting blocks", () => {
		const blocks: BlockComparison[] = [
			{ id: "api-v1", content: "fetch user by id string returns user", signature: "fetchUser(string) -> User" },
			{ id: "api-v2", content: "fetch user by id number returns user", signature: "fetchUser(number) -> UserDTO" },
		];
		const result = calculateSemanticConfusion({
			blocks,
			similarityThreshold: 0.6,
		});
		// 1 confusion pair out of C(2,2) = 1 pairs
		expect(result.value).toBe(1.0);
		expect(result.metadata?.confusionPairs).toHaveLength(1);
	});

	it("returns low value when blocks are semantically different", () => {
		const blocks: BlockComparison[] = [
			{ id: "auth", content: "validateToken(token: string): boolean", signature: "validateToken(string) -> boolean" },
			{ id: "db", content: "runQuery(sql: string): Promise<Row[]>", signature: "runQuery(string) -> Row[]" },
		];
		const result = calculateSemanticConfusion({
			blocks,
			similarityThreshold: 0.8,
		});
		expect(result.value).toBe(0);
	});

	it("handles multiple confusion pairs correctly", () => {
		const blocks: BlockComparison[] = [
			{ id: "v1", content: "fetch user with string id", signature: "fetchUser(string)" },
			{ id: "v2", content: "fetch user with number id", signature: "fetchUser(number)" },
			{ id: "v3", content: "fetch user with union id", signature: "fetchUser(string|number)" },
		];
		const result = calculateSemanticConfusion({
			blocks,
			similarityThreshold: 0.5,
		});
		// C(3,2) = 3 pairs, all might be confusion pairs
		expect(result.value).toBeGreaterThan(0);
		expect(result.value).toBeLessThanOrEqual(1);
	});
});