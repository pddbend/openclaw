import type { EffectiveLoad, TaskType } from "../types.js";

type EffectiveLoadInput = {
	rawUsage: number;
	distractorDensity: number;
	confusionRisk: number;
	positionalRisk: number;
	/** Distractor coefficient α (default: 2.0). */
	alpha?: number;
	/** Confusion coefficient β (default: 1.5). */
	beta?: number;
	/** Positional coefficient γ (default: 0.5). */
	gamma?: number;
};

/**
 * Calculate effective load accounting for distractors and positional risk.
 * Effective Load = raw_usage * distractor_amplifier * positional_factor
 */
export function calculateEffectiveLoad(input: EffectiveLoadInput): EffectiveLoad {
	const {
		rawUsage,
		distractorDensity,
		confusionRisk,
		positionalRisk,
		alpha = 2.0,
		beta = 1.5,
		gamma = 0.5,
	} = input;

	// Distractor amplifier: 1 + α * (distractor_density + β * confusion_risk)
	const distractorAmplifier = 1 + alpha * (distractorDensity + beta * confusionRisk);

	// Positional factor: 1 + γ * positional_risk
	const positionalFactor = 1 + gamma * positionalRisk;

	// Total effective load
	const total = rawUsage * distractorAmplifier * positionalFactor;

	return {
		rawUsage,
		distractorAmplifier,
		positionalFactor,
		total: Math.min(total, 2.0), // Cap at 2x
		taskType: "CODE_GENERATION", // Default, can be overridden
	};
}

/**
 * Task-specific patterns for inference.
 */
const TASK_PATTERNS: Record<TaskType, RegExp[]> = {
	MULTI_FILE_EDIT: [
		/\b(edit|modify|update|change)\s+(both|all|these|multiple)\s+\w+\s+(files|modules)/i,
		/\b(src\/\w+\.ts|src\/\w+\.js|apps\/\w+)[,\s]+(and|&)?\s*(src\/|apps\/)/i,
		/\b(edit|fix|update)\s+.*\b(and|then|also)\s+.*\b(edit|fix|update)/i,
	],
	DEBUGGING: [
		/\b(fix|debug|solve|resolve|investigate)\s+(the\s+)?(bug|error|issue|problem)/i,
		/\b(crash|exception|error|fail)/i,
		/\b(not working|doesn't work|broken)/i,
	],
	CODE_GENERATION: [
		/\b(add|create|implement|write|build)\s+(a\s+)?(new\s+)?\w+/i,
		/\b(feature|function|component|module|class|method)/i,
	],
	ARCHITECTURE: [
		/\b(design|architect|refactor|restructure|reorganize)\s+(the\s+)?(system|architecture|structure)/i,
		/\b(microservice|monolith|distributed|modular)\b/i,
	],
	SIMPLE_QA: [
		/\b(what|how|why|when|where|who)\s+(is|are|do|does|can)/i,
		/\b(explain|describe|tell me about)\b/i,
	],
};

/**
 * Infer task type from user query.
 */
export function inferTaskType(query: string): TaskType {
	for (const [type, patterns] of Object.entries(TASK_PATTERNS)) {
		for (const pattern of patterns) {
			if (pattern.test(query)) {
				return type as TaskType;
			}
		}
	}
	return "CODE_GENERATION";
}

/**
 * Task vulnerability scores (higher = more sensitive to context degradation).
 */
const TASK_VULNERABILITY: Record<TaskType, number> = {
	MULTI_FILE_EDIT: 0.8,
	DEBUGGING: 0.9,
	CODE_GENERATION: 0.4,
	ARCHITECTURE: 0.7,
	SIMPLE_QA: 0.2,
};

/**
 * Get task vulnerability score.
 */
export function getTaskVulnerability(taskType: TaskType): number {
	return TASK_VULNERABILITY[taskType] ?? 0.5;
}