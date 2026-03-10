import type { SignalMeasurement } from "../types.js";

export type DistractionInfo = {
	id: string;
	content: string;
	/** Whether this block is outdated/corrected/abandoned. */
	isOutdated: boolean;
	/** Similarity to the current active task. */
	similarity: number;
};

export type DistractorDensityInput = {
	blocks: DistractionInfo[];
	activeTaskQuery: string;
	/** Similarity threshold τ₁ for considering a block as potential distractor. */
	similarityThreshold?: number;
};

export type DistractorDensityResult = SignalMeasurement & {
	metadata: {
		distractorCount: number;
		totalBlocks: number;
		distractorIds: string[];
	};
};

/**
 * Calculate distractor density based on Chroma Research findings.
 * A distractor is a block that:
 * 1. Has high semantic similarity to the active task (> τ₁)
 * 2. Is marked as outdated/corrected/abandoned
 */
export function calculateDistractorDensity(
	input: DistractorDensityInput,
): DistractorDensityResult {
	const { blocks, similarityThreshold = 0.7 } = input;

	if (blocks.length === 0) {
		return {
			type: "distractor_density",
			value: 0,
			timestamp: Date.now(),
			metadata: {
				distractorCount: 0,
				totalBlocks: 0,
				distractorIds: [],
			},
		};
	}

	const distractors = blocks.filter(
		(block) => block.isOutdated && block.similarity > similarityThreshold,
	);

	return {
		type: "distractor_density",
		value: distractors.length / blocks.length,
		timestamp: Date.now(),
		metadata: {
			distractorCount: distractors.length,
			totalBlocks: blocks.length,
			distractorIds: distractors.map((d) => d.id),
		},
	};
}