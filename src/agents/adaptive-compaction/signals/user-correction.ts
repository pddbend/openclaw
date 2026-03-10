import type { SignalMeasurement } from "../types.js";

export type UserTurn = {
	id: string;
	content: string;
};

export type UserCorrectionInput = {
	turns: UserTurn[];
	/** Sliding window size W. */
	windowSize?: number;
};

export type UserCorrectionResult = SignalMeasurement & {
	metadata: {
		correctionCount: number;
		totalTurns: number;
		matchedPatterns: string[];
	};
};

// English correction patterns based on Higashinaka et al. 2016
const ENGLISH_CORRECTION_PATTERNS = [
	/i already (said|told|mentioned)/i,
	/that'?s (wrong|incorrect|not right)/i,
	/no,?\s*i (meant|want)/i,
	/you (forgot|missed)/i,
	/as i said before/i,
	/i didn't ask for/i,
	/that'?s not what i/i,
];

// Chinese correction patterns
const CHINESE_CORRECTION_PATTERNS = [
	/我之前说过/,
	/不对/,
	/不是/, // Context: 不是这个，是那个
	/你忘了/,
	/你搞(错|混)了/,
	/我要的是/,
	/我没说/,
];

/**
 * Calculate user correction rate based on implicit feedback research.
 * User corrections are strong indicators of quality degradation.
 */
export function calculateUserCorrectionRate(
	input: UserCorrectionInput,
): UserCorrectionResult {
	const { turns, windowSize = 5 } = input;

	if (turns.length === 0) {
		return {
			type: "user_correction",
			value: 0,
			timestamp: Date.now(),
			metadata: {
				correctionCount: 0,
				totalTurns: 0,
				matchedPatterns: [],
			},
		};
	}

	// Apply sliding window
	const windowTurns = turns.slice(-windowSize);

	let correctionCount = 0;
	const matchedPatterns: string[] = [];

	for (const turn of windowTurns) {
		let isCorrection = false;

		// Check English patterns
		for (const pattern of ENGLISH_CORRECTION_PATTERNS) {
			if (pattern.test(turn.content)) {
				isCorrection = true;
				matchedPatterns.push(`en:${pattern.source}`);
				break;
			}
		}

		// Check Chinese patterns (if not already matched)
		if (!isCorrection) {
			for (const pattern of CHINESE_CORRECTION_PATTERNS) {
				if (pattern.test(turn.content)) {
					isCorrection = true;
					matchedPatterns.push(`zh:${pattern.source}`);
					break;
				}
			}
		}

		if (isCorrection) {
			correctionCount++;
		}
	}

	return {
		type: "user_correction",
		value: correctionCount / windowTurns.length,
		timestamp: Date.now(),
		metadata: {
			correctionCount,
			totalTurns: windowTurns.length,
			matchedPatterns,
		},
	};
}