import { describe, it, expect } from "vitest";
import { HealthSynthesizer, type HealthSynthesizerInput } from "../../../../src/agents/adaptive-compaction/health/index.js";

describe("HealthSynthesizer", () => {
	it("starts with Bayesian for cold start", () => {
		const synthesizer = new HealthSynthesizer();
		const result = synthesizer.synthesize({
			signals: [],
			turnNumber: 1,
		});
		expect(result.method).toBe("bayesian");
	});

	it("transitions to logistic with enough data", () => {
		const synthesizer = new HealthSynthesizer({ minTurnsForLogistic: 3, transitionWindow: 1 });

		// Feed 3 turns of data
		for (let i = 0; i < 3; i++) {
			synthesizer.synthesize({
				signals: [
					{ type: "distractor_density", value: 0.3, timestamp: Date.now() },
				],
				turnNumber: i + 1,
				previousHealth: 0.8,
			});
		}

		// At turn 5 (after transitionEnd = 3+1 = 4), should use logistic
		const result = synthesizer.synthesize({
			signals: [
				{ type: "distractor_density", value: 0.4, timestamp: Date.now() },
			],
			turnNumber: 5,
			previousHealth: 0.75,
		});

		// Should use logistic after enough turns
		expect(result.method).toBe("logistic");
	});

	it("returns health in valid range", () => {
		const synthesizer = new HealthSynthesizer();

		const result = synthesizer.synthesize({
			signals: [
				{ type: "distractor_density", value: 0.9, timestamp: Date.now() },
				{ type: "user_correction", value: 0.8, timestamp: Date.now() },
			],
			turnNumber: 1,
		});

		expect(result.value).toBeGreaterThanOrEqual(0);
		expect(result.value).toBeLessThanOrEqual(1);
	});

	it("uses mixed method during transition", () => {
		const synthesizer = new HealthSynthesizer({ minTurnsForLogistic: 5 });

		// Feed 3 turns (less than threshold)
		for (let i = 0; i < 3; i++) {
			synthesizer.synthesize({
				signals: [{ type: "distractor_density", value: 0.3, timestamp: Date.now() }],
				turnNumber: i + 1,
			});
		}

		// At turn 4, should be in mixed mode
		const result = synthesizer.synthesize({
			signals: [{ type: "distractor_density", value: 0.3, timestamp: Date.now() }],
			turnNumber: 4,
		});

		expect(result.method).toBe("mixed");
	});

	it("tracks health history", () => {
		const synthesizer = new HealthSynthesizer();

		synthesizer.synthesize({
			signals: [],
			turnNumber: 1,
		});
		synthesizer.synthesize({
			signals: [],
			turnNumber: 2,
		});

		const history = synthesizer.getHistory();
		expect(history).toHaveLength(2);
	});
});