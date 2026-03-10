import { describe, it, expect } from "vitest";
import { calculateUserCorrectionRate, type UserTurn } from "../../../../src/agents/adaptive-compaction/signals/user-correction.js";

describe("calculateUserCorrectionRate", () => {
	it("returns 0 for empty history", () => {
		const result = calculateUserCorrectionRate({
			turns: [],
			windowSize: 5,
		});
		expect(result.value).toBe(0);
	});

	it("detects English correction patterns", () => {
		const turns: UserTurn[] = [
			{ id: "1", content: "Add a login form" },
			{ id: "2", content: "That's wrong, I meant a signup form" }, // Correction
			{ id: "3", content: "Make it blue" },
		];
		const result = calculateUserCorrectionRate({
			turns,
			windowSize: 5,
		});
		expect(result.value).toBe(1 / 3);
		expect(result.metadata?.correctionCount).toBe(1);
	});

	it("detects Chinese correction patterns", () => {
		const turns: UserTurn[] = [
			{ id: "1", content: "添加登录功能" },
			{ id: "2", content: "不对，我要的是注册功能" }, // Correction
			{ id: "3", content: "你忘了加验证" }, // Another correction
		];
		const result = calculateUserCorrectionRate({
			turns,
			windowSize: 5,
		});
		expect(result.value).toBe(2 / 3);
	});

	it("uses sliding window correctly", () => {
		const turns: UserTurn[] = [
			{ id: "1", content: "I already said this before" }, // Correction
			{ id: "2", content: "Add feature A" },
			{ id: "3", content: "Add feature B" },
			{ id: "4", content: "Add feature C" },
			{ id: "5", content: "Add feature D" },
			{ id: "6", content: "You forgot to..." }, // Correction, only this counted in window
		];
		const result = calculateUserCorrectionRate({
			turns,
			windowSize: 5, // Only looks at turns 2-6
		});
		// Only turn 6 is counted (turn 1 is outside window of 5 most recent)
		expect(result.value).toBe(1 / 5);
	});

	it("detects multiple correction patterns", () => {
		const turns: UserTurn[] = [
			{ id: "1", content: "As I said before, use TypeScript" },
			{ id: "2", content: "No, I meant JavaScript" },
			{ id: "3", content: "You forgot to add tests" },
		];
		const result = calculateUserCorrectionRate({
			turns,
			windowSize: 5,
		});
		// All 3 contain correction patterns
		expect(result.value).toBe(1.0);
	});
});