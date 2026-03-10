import { describe, it, expect } from "vitest";
import { BayesianHealthEstimator } from "../../../../src/agents/adaptive-compaction/health/bayesian.js";

describe("BayesianHealthEstimator", () => {
	it("starts with prior and updates with signals", () => {
		const estimator = new BayesianHealthEstimator({
			priorHealthy: 0.9,
			healthyDistribution: { alpha: 2, beta: 5 },
			unhealthyDistribution: { alpha: 5, beta: 2 },
		});

		// Initial health should be close to prior
		const initial = estimator.estimate();
		expect(initial.value).toBeCloseTo(0.9, 1);
		expect(initial.method).toBe("bayesian");
	});

	it("updates health with signals", () => {
		const estimator = new BayesianHealthEstimator({
			priorHealthy: 0.9,
		});

		// Update with signals
		estimator.update([
			{ type: "distractor_density", value: 0.8, timestamp: Date.now() },
			{ type: "user_correction", value: 0.6, timestamp: Date.now() },
		]);

		const after = estimator.estimate();
		// Health should have changed from prior
		expect(after.value).toBeGreaterThan(0);
		expect(after.value).toBeLessThan(1);
		expect(after.confidence).toBeGreaterThan(0.3);
	});

	it("increases confidence with more observations", () => {
		const estimator = new BayesianHealthEstimator({
			priorHealthy: 0.5,
		});

		const initial = estimator.estimate();

		// Multiple updates
		for (let i = 0; i < 5; i++) {
			estimator.update([
				{ type: "response_repetition", value: 0.95, timestamp: Date.now() },
			]);
		}

		const after = estimator.estimate();
		expect(after.confidence).toBeGreaterThan(initial.confidence);
	});

	it("health value stays in valid range [0, 1]", () => {
		const estimator = new BayesianHealthEstimator({
			priorHealthy: 0.5,
		});

		// Multiple updates with various signals
		for (let i = 0; i < 10; i++) {
			estimator.update([
				{ type: "distractor_density", value: Math.random(), timestamp: Date.now() },
				{ type: "user_correction", value: Math.random(), timestamp: Date.now() },
			]);
		}

		const after = estimator.estimate();
		expect(after.value).toBeGreaterThanOrEqual(0);
		expect(after.value).toBeLessThanOrEqual(1);
	});
});