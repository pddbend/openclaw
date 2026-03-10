import { describe, it, expect } from "vitest";
import { PredictionEngine } from "../../../../src/agents/adaptive-compaction/prediction/index.js";

describe("PredictionEngine", () => {
	it("starts with conservative prior for cold start", () => {
		const engine = new PredictionEngine({ taskVulnerability: 0.8 });
		const threshold = engine.getCurrentThreshold(1.0);

		// High vulnerability = conservative threshold
		expect(threshold.rawUsageThreshold).toBeLessThan(0.8);
		expect(threshold.confidenceLevel).toBe(95); // High confidence z-score
	});

	it("updates GP with new observations", () => {
		const engine = new PredictionEngine({ taskVulnerability: 0.5 });

		engine.addObservations([
			{ effectiveLoad: 0.2, health: 0.9 },
			{ effectiveLoad: 0.3, health: 0.85 },
		]);

		const threshold = engine.getCurrentThreshold(1.0);
		expect(threshold).toBeDefined();
	});

	it("adjusts threshold based on observed trend", () => {
		const engine = new PredictionEngine({ taskVulnerability: 0.5 });

		// Fast-declining health
		engine.addObservations([
			{ effectiveLoad: 0.1, health: 0.95 },
			{ effectiveLoad: 0.2, health: 0.80 },
			{ effectiveLoad: 0.25, health: 0.65 }, // Below Q_min
		]);

		const threshold = engine.getCurrentThreshold(1.0);

		// Should detect rapid decline and set low threshold
		expect(threshold.rawUsageThreshold).toBeLessThan(0.4);
	});

	it("tracks observation count", () => {
		const engine = new PredictionEngine({ taskVulnerability: 0.5 });

		expect(engine.hasEnoughData()).toBe(false);
		expect(engine.getObservationCount()).toBe(0);

		engine.addObservations([
			{ effectiveLoad: 0.2, health: 0.9 },
		]);

		expect(engine.getObservationCount()).toBe(1);
	});

	it("signals enough data after minimum turns", () => {
		const engine = new PredictionEngine({ taskVulnerability: 0.5, minTurnsForGP: 3 });

		expect(engine.hasEnoughData()).toBe(false);

		engine.addObservations([
			{ effectiveLoad: 0.1, health: 0.95 },
			{ effectiveLoad: 0.2, health: 0.9 },
			{ effectiveLoad: 0.3, health: 0.85 },
		]);

		expect(engine.hasEnoughData()).toBe(true);
	});
});