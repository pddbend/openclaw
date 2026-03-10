import { describe, it, expect } from "vitest";
import { detectEmergency, type EmergencyDetectionInput } from "../../../../src/agents/adaptive-compaction/emergency/conditions.js";

describe("detectEmergency", () => {
	it("returns null when no emergency conditions met", () => {
		const input: EmergencyDetectionInput = {
			recentHealthScores: [0.9, 0.88, 0.87, 0.85, 0.84],
			currentHealth: 0.83,
			correctionRate: 0.1,
			distractorDensity: 0.2,
			distractorDensityDelta: 0.05,
			consecutiveCorrectionCount: 0,
		};
		expect(detectEmergency(input)).toBeNull();
	});

	it("detects consecutive corrections emergency", () => {
		const input: EmergencyDetectionInput = {
			recentHealthScores: [0.9, 0.85],
			currentHealth: 0.8,
			correctionRate: 0.5,
			distractorDensity: 0.2,
			distractorDensityDelta: 0.1,
			consecutiveCorrectionCount: 2,
		};
		const result = detectEmergency(input);
		expect(result).not.toBeNull();
		expect(result?.type).toBe("consecutive_corrections");
	});

	it("detects health sudden drop using 3σ rule", () => {
		// Mean = 0.9, std = 0.02, currentHealth = 0.75 is far below 3σ
		const input: EmergencyDetectionInput = {
			recentHealthScores: [0.92, 0.90, 0.88, 0.91, 0.89], // Mean ≈ 0.9
			currentHealth: 0.75, // Far below mean - 3σ
			correctionRate: 0.1,
			distractorDensity: 0.2,
			distractorDensityDelta: 0.1,
			consecutiveCorrectionCount: 0,
		};
		const result = detectEmergency(input);
		expect(result).not.toBeNull();
		expect(result?.type).toBe("health_sudden_drop");
	});

	it("detects distractor spike emergency", () => {
		const input: EmergencyDetectionInput = {
			recentHealthScores: [0.9],
			currentHealth: 0.85,
			correctionRate: 0.1,
			distractorDensity: 0.5,
			distractorDensityDelta: 0.35, // > 0.3 threshold
			consecutiveCorrectionCount: 0,
		};
		const result = detectEmergency(input);
		expect(result).not.toBeNull();
		expect(result?.type).toBe("distractor_spike");
	});
});