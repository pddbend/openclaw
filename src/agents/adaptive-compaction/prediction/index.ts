import type { DynamicThreshold } from "../types.js";
import { GaussianProcessRegressor } from "./gaussian-process.js";
import { calculateDynamicThreshold } from "./threshold.js";

type Observation = {
	effectiveLoad: number;
	health: number;
};

type PredictionConfig = {
	taskVulnerability: number;
	minTurnsForGP?: number;
};

/**
 * Orchestrates GP-based prediction and threshold calculation.
 */
export class PredictionEngine {
	private readonly gp: GaussianProcessRegressor;
	private readonly taskVulnerability: number;
	private readonly minTurnsForGP: number;
	private observationCount = 0;

	constructor(config: PredictionConfig) {
		this.taskVulnerability = config.taskVulnerability;
		this.minTurnsForGP = config.minTurnsForGP ?? 4;

		// Initialize GP with prior based on task vulnerability
		this.gp = new GaussianProcessRegressor({
			meanFunction: (x) => 1 - this.taskVulnerability * x,
		});
	}

	/**
	 * Add new (effectiveLoad, health) observations to the GP.
	 */
	addObservations(observations: Observation[]): void {
		for (const obs of observations) {
			this.gp.addObservation(obs.effectiveLoad, obs.health);
			this.observationCount++;
		}
	}

	/**
	 * Get the current dynamic threshold.
	 */
	getCurrentThreshold(currentAmplifier: number): DynamicThreshold {
		return calculateDynamicThreshold({
			gp: this.gp,
			taskVulnerability: this.taskVulnerability,
			currentAmplifier,
		});
	}

	/**
	 * Check if we have enough data for GP prediction.
	 */
	hasEnoughData(): boolean {
		return this.observationCount >= this.minTurnsForGP;
	}

	/**
	 * Get observation count.
	 */
	getObservationCount(): number {
		return this.observationCount;
	}
}

export { GaussianProcessRegressor } from "./gaussian-process.js";
export { calculateDynamicThreshold } from "./threshold.js";