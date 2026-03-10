import { describe, it, expect } from "vitest";
import { calculateEffectiveLoad, inferTaskType, getTaskVulnerability } from "../../../../src/agents/adaptive-compaction/effective-load/index.js";

describe("calculateEffectiveLoad", () => {
	it("returns raw usage when no distractors or positional risk", () => {
		const result = calculateEffectiveLoad({
			rawUsage: 0.5,
			distractorDensity: 0,
			confusionRisk: 0,
			positionalRisk: 0,
		});
		expect(result.total).toBeCloseTo(0.5);
		expect(result.distractorAmplifier).toBe(1.0);
		expect(result.positionalFactor).toBe(1.0);
	});

	it("amplifies load based on distractor density", () => {
		const result = calculateEffectiveLoad({
			rawUsage: 0.5,
			distractorDensity: 0.3,
			confusionRisk: 0.1,
			positionalRisk: 0.2,
		});
		// With distractors, effective load should be higher than raw
		expect(result.total).toBeGreaterThan(0.5);
		expect(result.distractorAmplifier).toBeGreaterThan(1.0);
	});

	it("applies positional risk factor", () => {
		const result = calculateEffectiveLoad({
			rawUsage: 0.5,
			distractorDensity: 0,
			confusionRisk: 0,
			positionalRisk: 0.4,
		});
		// With positional risk, the factor should be > 1
		expect(result.positionalFactor).toBeGreaterThan(1.0);
	});
});

describe("inferTaskType", () => {
	it("detects multi-file edit from file paths", () => {
		const type = inferTaskType(
			"Edit src/config.ts, src/utils.ts, and src/main.ts",
		);
		expect(type).toBe("MULTI_FILE_EDIT");
	});

	it("detects debugging from keywords", () => {
		const type = inferTaskType("Fix the bug in the authentication module");
		expect(type).toBe("DEBUGGING");
	});

	it("detects architecture from keywords", () => {
		const type = inferTaskType("Design the system architecture for microservices");
		expect(type).toBe("ARCHITECTURE");
	});

	it("defaults to code generation", () => {
		const type = inferTaskType("Add a new button to the login page");
		expect(type).toBe("CODE_GENERATION");
	});
});

describe("getTaskVulnerability", () => {
	it("returns high vulnerability for multi-file edit", () => {
		const v = getTaskVulnerability("MULTI_FILE_EDIT");
		expect(v).toBeGreaterThan(0.7);
	});

	it("returns high vulnerability for debugging", () => {
		const v = getTaskVulnerability("DEBUGGING");
		expect(v).toBeGreaterThan(0.7);
	});

	it("returns low vulnerability for simple Q&A", () => {
		const v = getTaskVulnerability("SIMPLE_QA");
		expect(v).toBeLessThan(0.3);
	});
});