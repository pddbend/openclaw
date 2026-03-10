import { describe, it, expect } from "vitest";
import { calculatePositionalRisk, type PositionedBlock } from "../../../../src/agents/adaptive-compaction/signals/positional-risk.js";

describe("calculatePositionalRisk", () => {
	it("returns 0 for empty context", () => {
		const result = calculatePositionalRisk({
			blocks: [],
			totalContextLength: 1000,
		});
		expect(result.value).toBe(0);
	});

	it("gives low risk for blocks at start and end", () => {
		const blocks: PositionedBlock[] = [
			{ id: "1", offset: 0, length: 100, isKeyInfo: true },    // Start: high visibility
			{ id: "2", offset: 900, length: 100, isKeyInfo: true },  // End: high visibility
		];
		const result = calculatePositionalRisk({
			blocks,
			totalContextLength: 1000,
		});
		// Both are in high-visibility regions
		expect(result.value).toBeLessThan(0.2);
	});

	it("gives high risk for key blocks in middle", () => {
		const blocks: PositionedBlock[] = [
			{ id: "1", offset: 450, length: 100, isKeyInfo: true }, // Middle: low visibility
		];
		const result = calculatePositionalRisk({
			blocks,
			totalContextLength: 1000,
		});
		// In the middle, visibility is about 50%, risk = 1 - 0.5 = 0.5
		expect(result.value).toBeGreaterThan(0.3);
		expect(result.value).toBeLessThan(0.7);
	});

	it("correctly computes U-shaped visibility", () => {
		const blocks: PositionedBlock[] = [
			{ id: "start", offset: 0, length: 100, isKeyInfo: true },
			{ id: "mid-start", offset: 300, length: 100, isKeyInfo: true },
			{ id: "mid", offset: 450, length: 100, isKeyInfo: true },
			{ id: "mid-end", offset: 600, length: 100, isKeyInfo: true },
			{ id: "end", offset: 900, length: 100, isKeyInfo: true },
		];
		const result = calculatePositionalRisk({
			blocks,
			totalContextLength: 1000,
		});
		// Average of visibility: start(~95%), mid-start(~55%), mid(~50%), mid-end(~55%), end(~90%)
		// Average visibility ~69%, risk = 1 - 0.69 = 0.31
		expect(result.value).toBeGreaterThan(0.2);
		expect(result.value).toBeLessThan(0.5);
	});

	it("ignores non-key blocks", () => {
		const blocks: PositionedBlock[] = [
			{ id: "1", offset: 450, length: 100, isKeyInfo: false }, // Not key info
		];
		const result = calculatePositionalRisk({
			blocks,
			totalContextLength: 1000,
		});
		// No key blocks = no risk
		expect(result.value).toBe(0);
	});
});