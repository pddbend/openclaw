import { describe, it, expect } from "vitest";
import { GaussianProcessRegressor } from "../../../../src/agents/adaptive-compaction/prediction/gaussian-process.js";

describe("GaussianProcessRegressor", () => {
	it("starts with prior mean when no observations", () => {
		const gp = new GaussianProcessRegressor({
			lengthScale: 0.5,
			noiseVariance: 0.01,
		});

		const prediction = gp.predict(0.5);
		// Prior: mean = 1 - x * 0.5 = 1 - 0.5 * 0.5 = 0.75
		expect(prediction.mean).toBeCloseTo(0.75, 1);
		expect(prediction.variance).toBeGreaterThan(0);
	});

	it("updates predictions with observations", () => {
		const gp = new GaussianProcessRegressor();

		// Add observation: at low load, health is high
		gp.addObservation(0.1, 0.95);

		const prediction = gp.predict(0.1);
		expect(prediction.mean).toBeCloseTo(0.95, 1);
		expect(prediction.variance).toBeLessThan(0.1); // Low uncertainty at observed point
	});

	it("predicts smooth function between observations", () => {
		const gp = new GaussianProcessRegressor();

		gp.addObservation(0.1, 0.9);
		gp.addObservation(0.5, 0.6);

		// Prediction at 0.3 should be between 0.9 and 0.6
		const prediction = gp.predict(0.3);
		expect(prediction.mean).toBeGreaterThan(0.6);
		expect(prediction.mean).toBeLessThan(0.9);
	});

	it("estimates uncertainty that increases away from observations", () => {
		const gp = new GaussianProcessRegressor();

		gp.addObservation(0.2, 0.85);

		const nearPoint = gp.predict(0.21);
		const farPoint = gp.predict(0.8);

		// Uncertainty should be lower near the observation
		expect(nearPoint.variance).toBeLessThan(farPoint.variance);
	});

	it("can retrieve stored observations", () => {
		const gp = new GaussianProcessRegressor();

		gp.addObservation(0.1, 0.9);
		gp.addObservation(0.3, 0.7);

		const observations = gp.getObservations();
		expect(observations).toHaveLength(2);
		expect(observations[0]).toEqual({ x: 0.1, y: 0.9 });
	});
});