import type { EmergencyTrigger } from "../types.js";

export type EmergencyDetectionInput = {
	recentHealthScores: number[];
	currentHealth: number;
	correctionRate: number;
	distractorDensity: number;
	distractorDensityDelta: number;
	consecutiveCorrectionCount: number;
	/** Consecutive corrections threshold (default: 2). */
	consecutiveThreshold?: number;
	/** Sigma count for health drop (default: 3). */
	sigmaThreshold?: number;
	/** Distractor spike delta (default: 0.3). */
	distractorSpikeThreshold?: number;
};

/**
 * Detect emergency conditions that bypass normal prediction.
 * Based on Shewhart Control Chart and Higashinaka et al. 2016.
 */
export function detectEmergency(
	input: EmergencyDetectionInput,
): EmergencyTrigger | null {
	const {
		recentHealthScores,
		currentHealth,
		consecutiveCorrectionCount,
		distractorDensityDelta,
		consecutiveThreshold = 2,
		sigmaThreshold = 3,
		distractorSpikeThreshold = 0.3,
	} = input;

	// Check 1: Consecutive corrections
	if (consecutiveCorrectionCount >= consecutiveThreshold) {
		return {
			type: "consecutive_corrections",
			count: consecutiveCorrectionCount,
		};
	}

	// Check 2: Health sudden drop (3σ rule)
	if (recentHealthScores.length >= 3) {
		const { mean, std } = calculateStats(recentHealthScores);
		const lowerBound = mean - sigmaThreshold * std;

		if (currentHealth < lowerBound) {
			return {
				type: "health_sudden_drop",
				healthBefore: mean,
				healthAfter: currentHealth,
			};
		}
	}

	// Check 3: Distractor spike
	if (distractorDensityDelta > distractorSpikeThreshold) {
		return {
			type: "distractor_spike",
			delta: distractorDensityDelta,
		};
	}

	return null;
}

function calculateStats(values: number[]): { mean: number; std: number } {
	const n = values.length;
	if (n === 0) return { mean: 0, std: 0 };

	const mean = values.reduce((sum, v) => sum + v, 0) / n;
	const variance =
		values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
	const std = Math.sqrt(variance);

	return { mean, std };
}