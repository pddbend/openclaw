import type { SignalMeasurement } from "../types.js";

export type PositionedBlock = {
	id: string;
	offset: number;
	length: number;
	isKeyInfo: boolean;
};

export type PositionalRiskInput = {
	blocks: PositionedBlock[];
	totalContextLength: number;
	/** U-curve steepness parameter. Higher = sharper transitions. */
	visibilityK?: number;
};

export type PositionalRiskResult = SignalMeasurement & {
	metadata: {
		keyBlockCount: number;
		keyBlockPositions: Array<{ id: string; position: number; visibility: number }>;
	};
};

/**
 * Calculate positional visibility risk based on Liu et al. 2023 findings.
 * LLMs have U-shaped attention: start and end are well-attended,
 * middle positions are often "lost".
 */
export function calculatePositionalRisk(
	input: PositionalRiskInput,
): PositionalRiskResult {
	const { blocks, totalContextLength, visibilityK = 10 } = input;

	const keyBlocks = blocks.filter((b) => b.isKeyInfo);

	if (keyBlocks.length === 0 || totalContextLength === 0) {
		return {
			type: "positional_risk",
			value: 0,
			timestamp: Date.now(),
			metadata: {
				keyBlockCount: 0,
				keyBlockPositions: [],
			},
		};
	}

	const positionsWithVisibility = keyBlocks.map((block) => {
		// Normalized position (0 to 1)
		const centerOffset = block.offset + block.length / 2;
		const p = centerOffset / totalContextLength;

		// U-curve visibility function
		// Based on Liu et al. findings:
		// - p in [0, 0.1]: visibility ~ 0.90-1.0
		// - p in [0.3, 0.7]: visibility ~ 0.40-0.60
		// - p in [0.9, 1.0]: visibility ~ 0.80-0.95
		const visibility = uCurveVisibility(p, visibilityK);

		return {
			id: block.id,
			position: p,
			visibility,
		};
	});

	const avgVisibility =
		positionsWithVisibility.reduce((sum, p) => sum + p.visibility, 0) /
		positionsWithVisibility.length;

	// Risk = 1 - average_visibility
	const risk = 1 - avgVisibility;

	return {
		type: "positional_risk",
		value: risk,
		timestamp: Date.now(),
		metadata: {
			keyBlockCount: keyBlocks.length,
			keyBlockPositions: positionsWithVisibility,
		},
	};
}

/**
 * U-curve visibility function based on Liu et al. 2023.
 * Approximates the experimental retrieval accuracy at different positions.
 */
function uCurveVisibility(p: number, k: number): number {
	// Clamp p to [0, 1]
	p = Math.max(0, Math.min(1, p));

	// Use a quadratic U-curve with adjustments for endpoint boost
	// Base U-curve: minimum at p=0.5, higher at ends
	// v(p) = v_min + (v_max - v_min) * 4 * (p - 0.5)^2

	// From Liu et al. data:
	// - v_max (at ends) ≈ 0.95
	// - v_min (at middle) ≈ 0.45
	const vMax = 0.95;
	const vMin = 0.45;

	// U-curve component: 4*(p-0.5)^2 gives 0 at p=0.5, 1 at p=0 or p=1
	const uComponent = vMin + (vMax - vMin) * 4 * Math.pow(p - 0.5, 2);

	// Apply sigmoid smoothing at boundaries for k > 0
	if (k > 0) {
		// Smooth transition at boundaries
		const edgeBoost = Math.exp(-k * Math.min(p, 1 - p));
		return uComponent * (1 + 0.1 * edgeBoost);
	}

	return uComponent;
}