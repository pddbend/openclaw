import { describe, it, expect } from "vitest";
import { calculateDynamicThreshold } from "../../../../src/agents/adaptive-compaction/prediction/threshold.js";
import { GaussianProcessRegressor } from "../../../../src/agents/adaptive-compaction/prediction/gaussian-process.js";

describe("calculateDynamicThreshold", () => {
	it("returns conservative threshold with no data", () => {
		const gp = new GaussianProcessRegressor();
		const result = calculateDynamicThreshold({
			gp,
			taskVulnerability: 0.5,
			currentAmplifier: 1.0,
		});

		// Should be conservative (low threshold) when uncertain
		expect(result.rawUsageThreshold).toBeLessThan(0.8);
		expect(result.riskTolerance).toBeGreaterThan(0); // Has z-score
	});

	it("finds critical point where lower bound crosses quality min", () => {
		const gp = new GaussianProcessRegressor();
		gp.addObservation(0.1, 0.95);
		gp.addObservation(0.3, 0.85);
		gp.addObservation(0.5, 0.60); // Below Q_min

		const result = calculateDynamicThreshold({
			gp,
			taskVulnerability: 0.5,
			currentAmplifier: 1.0,
		});

		// Should find threshold before 0.5 since health drops below Q_min
		expect(result.effectiveLoadCritical).toBeLessThan(0.6);
	});

	it("uses high z-score for vulnerable tasks", () => {
		const gp = new GaussianProcessRegressor();
		gp.addObservation(0.1, 0.95);

		const highVuln = calculateDynamicThreshold({
			gp,
			taskVulnerability: 0.9, // High vulnerability
			currentAmplifier: 1.0,
		});

		const lowVuln = calculateDynamicThreshold({
			gp,
			taskVulnerability: 0.2, // Low vulnerability
			currentAmplifier: 1.0,
		});

		// High vulnerability should use higher z-score (more conservative)
		expect(highVuln.riskTolerance).toBeGreaterThan(lowVuln.riskTolerance);
	});

	it("converts effective load threshold to raw usage", () => {
		const gp = new GaussianProcessRegressor();
		gp.addObservation(0.2, 0.9);
		gp.addObservation(0.4, 0.75);

		const result = calculateDynamicThreshold({
			gp,
			taskVulnerability: 0.5,
			currentAmplifier: 1.5, // Amplifier > 1
		});

		// rawUsageThreshold = effectiveLoadCritical / amplifier
		expect(result.rawUsageThreshold).toBeLessThan(result.effectiveLoadCritical);
		expect(result.rawUsageThreshold).toBeCloseTo(
			result.effectiveLoadCritical / 1.5,
			1,
		);
	});
});