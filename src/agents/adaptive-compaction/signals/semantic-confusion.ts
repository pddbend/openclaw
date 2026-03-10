import type { SignalMeasurement } from "../types.js";

export type BlockComparison = {
	id: string;
	content: string;
	/** Extracted signature or key facts for comparison. */
	signature?: string;
};

export type SemanticConfusionInput = {
	blocks: BlockComparison[];
	/** Similarity threshold τ₂ for identifying confusion pairs. */
	similarityThreshold?: number;
	/** Custom similarity function (defaults to Jaccard on words). */
	similarityFn?: (a: BlockComparison, b: BlockComparison) => number;
};

export type ConfusionPair = {
	blockA: string;
	blockB: string;
	similarity: number;
	conflictingFacts: boolean;
};

export type SemanticConfusionResult = SignalMeasurement & {
	metadata: {
		confusionPairs: ConfusionPair[];
		totalPairs: number;
	};
};

/**
 * Calculate semantic confusion risk based on Chroma Research findings.
 * Confusion pairs are blocks that are semantically similar but contain
 * different concrete facts (different signatures, values, types).
 */
export function calculateSemanticConfusion(
	input: SemanticConfusionInput,
): SemanticConfusionResult {
	const { blocks, similarityThreshold = 0.8 } = input;
	const n = blocks.length;

	if (n < 2) {
		return {
			type: "semantic_confusion",
			value: 0,
			timestamp: Date.now(),
			metadata: {
				confusionPairs: [],
				totalPairs: 0,
			},
		};
	}

	const simFn = input.similarityFn ?? defaultSimilarity;
	const confusionPairs: ConfusionPair[] = [];

	// Check all pairs
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const similarity = simFn(blocks[i], blocks[j]);
			if (similarity > similarityThreshold) {
				// Check if they have conflicting facts (different signatures)
				const conflicting =
					blocks[i].signature !== undefined &&
					blocks[j].signature !== undefined &&
					blocks[i].signature !== blocks[j].signature;

				if (conflicting) {
					confusionPairs.push({
						blockA: blocks[i].id,
						blockB: blocks[j].id,
						similarity,
						conflictingFacts: conflicting,
					});
				}
			}
		}
	}

	const totalPairs = (n * (n - 1)) / 2;

	return {
		type: "semantic_confusion",
		value: confusionPairs.length / totalPairs,
		timestamp: Date.now(),
		metadata: {
			confusionPairs,
			totalPairs,
		},
	};
}

function defaultSimilarity(a: BlockComparison, b: BlockComparison): number {
	const wordsA = new Set(a.content.toLowerCase().split(/\s+/));
	const wordsB = new Set(b.content.toLowerCase().split(/\s+/));
	const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
	const union = new Set([...wordsA, ...wordsB]);
	return intersection.size / union.size;
}