import type { AgentMessage } from "@mariozechner/pi-agent-core";

/**
 * Task type influences baseline vulnerability and amplifier defaults.
 */
export type TaskType =
	| "MULTI_FILE_EDIT"
	| "DEBUGGING"
	| "CODE_GENERATION"
	| "ARCHITECTURE"
	| "SIMPLE_QA";

/**
 * One of 5 quality signals from the literature.
 */
export type SignalType =
	| "distractor_density"
	| "semantic_confusion"
	| "positional_risk"
	| "user_correction"
	| "response_repetition";

/**
 * Individual signal measurement.
 */
export type SignalMeasurement = {
	type: SignalType;
	value: number; // 0.0 ~ 1.0
	timestamp: number;
	metadata?: Record<string, unknown>;
};

/**
 * Collection of all signals for a turn.
 */
export type SignalSnapshot = {
	turnNumber: number;
	measurements: SignalMeasurement[];
	rawUsage: number; // currentTokens / maxContextWindow
};

/**
 * Emergency trigger reason.
 */
export type EmergencyTrigger =
	| { type: "consecutive_corrections"; count: number }
	| { type: "health_sudden_drop"; healthBefore: number; healthAfter: number }
	| { type: "distractor_spike"; delta: number };

/**
 * Health synthesis result.
 */
export type HealthScore = {
	value: number; // 0.0 ~ 1.0
	method: "bayesian" | "logistic" | "mixed";
	confidence: number; // 0.0 ~ 1.0
	turnNumber: number;
};

/**
 * Effective load calculation result.
 */
export type EffectiveLoad = {
	rawUsage: number;
	distractorAmplifier: number;
	positionalFactor: number;
	total: number; // rawUsage * distractorAmplifier * positionalFactor
	taskType: TaskType;
};

/**
 * GP prediction output.
 */
export type GPPrediction = {
	mean: number; // Predicted health at given load
	variance: number; // Uncertainty
	effectiveLoad: number;
};

/**
 * Dynamic threshold calculation result.
 */
export type DynamicThreshold = {
	rawUsageThreshold: number;
	effectiveLoadCritical: number;
	confidenceLevel: number;
	riskTolerance: number; // z-score used
};

/**
 * Compression decision.
 */
export type CompressionDecision = {
	shouldCompact: boolean;
	trigger: "emergency" | "predicted" | "manual";
	emergencyReason?: EmergencyTrigger;
	threshold: DynamicThreshold;
	targetEffectiveLoad: number;
	prioritizedItems: CompressionPriority[];
};

/**
 * Compression priority for context blocks.
 */
export type CompressionPriority = {
	blockId: string;
	priority: "delete_first" | "delete_second" | "keep" | "preserve_strict";
	reason: string;
	estimatedTokenSavings: number;
	distractorScore: number;
};

/**
 * Configuration for adaptive compaction.
 */
export type AdaptiveCompactionConfig = {
	enabled: boolean;
	// Signal collection
	signalCollection: {
		distractorDensityWindow: number; // How many turns to look back
		confusionSimilarityThreshold: number; // τ₂
		positionalVisibilityK: number; // U-curve steepness
		correctionWindowW: number; // Sliding window size
		repetitionWindow: number; // How many recent responses to compare
	};
	// Emergency thresholds
	emergencyDetectors: {
		consecutiveCorrections: number; // Default 2
		healthDropSigmaCount: number; // Default 3
		distractorSpikeDelta: number; // Default 0.3
	};
	// Effective load parameters
	loadAmplifiers: {
		alpha: number; // Distractor density coefficient (default 2.0)
		beta: number; // Confusion risk coefficient (default 1.5)
		gamma: number; // Positional risk coefficient (default 0.5)
	};
	// Prediction settings
	prediction: {
		minTurnsForGP: number; // Default 4
		baseQualityMin: number; // Default 0.70
		qualityAdjustmentFactor: number; // Default 0.2
		retreatCoefficient: number; // Default 0.6
	};
	// Task type inference
	taskInference: {
		enabled: boolean;
		multiFileThreshold: number; // File paths mentioning threshold
	};
};