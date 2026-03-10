import type { SignalMeasurement, SignalSnapshot } from "../types.js";
import { calculateDistractorDensity, type DistractionInfo } from "./distractor-density.js";
import { calculateSemanticConfusion, type BlockComparison } from "./semantic-confusion.js";
import { calculatePositionalRisk, type PositionedBlock } from "./positional-risk.js";
import { calculateUserCorrectionRate, type UserTurn } from "./user-correction.js";
import { calculateResponseRepetition, type AgentResponse } from "./response-repetition.js";

export type SignalCollectionInput = {
	blocks: Array<{
		id: string;
		content: string;
		offset: number;
		length: number;
		isKeyInfo: boolean;
		isOutdated: boolean;
		similarity: number;
		signature?: string;
	}>;
	totalContextLength: number;
	userTurns: UserTurn[];
	agentResponses: AgentResponse[];
	activeTaskQuery: string;
	contextWindow: number;
	currentTokens: number;
	turnNumber: number;
};

export type SignalCollectionResult = SignalSnapshot;

/**
 * Collect all 5 quality signals in one pass.
 */
export function collectSignals(input: SignalCollectionInput): SignalCollectionResult {
	const measurements: SignalMeasurement[] = [];

	// 1. Distractor Density
	const distractorInput: DistractionInfo[] = input.blocks.map((b) => ({
		id: b.id,
		content: b.content,
		isOutdated: b.isOutdated,
		similarity: b.similarity,
	}));
	measurements.push(
		calculateDistractorDensity({
			blocks: distractorInput,
			activeTaskQuery: input.activeTaskQuery,
		}),
	);

	// 2. Semantic Confusion
	const confusionInput: BlockComparison[] = input.blocks.map((b) => ({
		id: b.id,
		content: b.content,
		signature: b.signature,
	}));
	measurements.push(calculateSemanticConfusion({ blocks: confusionInput }));

	// 3. Positional Risk
	const positionInput: PositionedBlock[] = input.blocks.map((b) => ({
		id: b.id,
		offset: b.offset,
		length: b.length,
		isKeyInfo: b.isKeyInfo,
	}));
	measurements.push(
		calculatePositionalRisk({
			blocks: positionInput,
			totalContextLength: input.totalContextLength,
		}),
	);

	// 4. User Correction Rate
	measurements.push(
		calculateUserCorrectionRate({ turns: input.userTurns }),
	);

	// 5. Response Repetition
	measurements.push(
		calculateResponseRepetition({ responses: input.agentResponses }),
	);

	return {
		turnNumber: input.turnNumber,
		measurements,
		rawUsage: input.currentTokens / input.contextWindow,
	};
}

// Re-export individual signal calculators
export { calculateDistractorDensity } from "./distractor-density.js";
export { calculateSemanticConfusion } from "./semantic-confusion.js";
export { calculatePositionalRisk } from "./positional-risk.js";
export { calculateUserCorrectionRate } from "./user-correction.js";
export { calculateResponseRepetition } from "./response-repetition.js";