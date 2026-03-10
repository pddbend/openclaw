import type { HealthScore, SignalMeasurement } from "../types.js";
import { BayesianHealthEstimator } from "./bayesian.js";

export type HealthSynthesizerInput = {
	signals: SignalMeasurement[];
	turnNumber: number;
	previousHealth?: number;
};

type HealthSynthesizerConfig = {
	minTurnsForLogistic?: number;
	transitionWindow?: number;
};

/**
 * Health Synthesizer combines Bayesian (cold start) with Logistic Regression.
 * Transitions smoothly between methods as data accumulates.
 */
export class HealthSynthesizer {
	private readonly bayesian: BayesianHealthEstimator;
	private readonly minTurnsForLogistic: number;
	private readonly transitionWindow: number;
	private readonly history: HealthScore[] = [];
	private turnCount = 0;

	// Logistic regression weights (learned online via SGD)
	private weights: Record<string, number> = {
		distractor_density: -0.3,
		semantic_confusion: -0.2,
		positional_risk: -0.15,
		user_correction: -0.25,
		response_repetition: 0.2,
	};
	private bias = 0.8;

	constructor(config: HealthSynthesizerConfig = {}) {
		this.bayesian = new BayesianHealthEstimator();
		this.minTurnsForLogistic = config.minTurnsForLogistic ?? 5;
		this.transitionWindow = config.transitionWindow ?? 2;
	}

	/**
	 * Synthesize health from signals using appropriate method.
	 */
	synthesize(input: HealthSynthesizerInput): HealthScore {
		this.turnCount = input.turnNumber;

		// Always update Bayesian
		this.bayesian.update(input.signals);
		const bayesianHealth = this.bayesian.estimate();

		// Update logistic weights if we have previous health
		if (input.previousHealth !== undefined && input.signals.length > 0) {
			this.updateLogisticWeights(input.signals, input.previousHealth);
		}

		// Calculate logistic health
		const logisticHealth = this.logisticPredict(input.signals);

		// Determine method and blend
		const result = this.blendMethods(bayesianHealth, logisticHealth, input.turnNumber);

		this.history.push(result);
		return result;
	}

	/**
	 * Blend Bayesian and Logistic predictions based on data availability.
	 */
	private blendMethods(
		bayesian: HealthScore,
		logisticValue: number,
		turnNumber: number,
	): HealthScore {
		const transitionStart = this.minTurnsForLogistic - this.transitionWindow;
		const transitionEnd = this.minTurnsForLogistic + this.transitionWindow;

		if (turnNumber < transitionStart) {
			// Pure Bayesian
			return bayesian;
		}

		if (turnNumber > transitionEnd) {
			// Pure Logistic
			return {
				value: logisticValue,
				method: "logistic",
				confidence: Math.min(1.0, 0.5 + turnNumber * 0.05),
				turnNumber,
			};
		}

		// Mixed during transition
		const progress = (turnNumber - transitionStart) / (transitionEnd - transitionStart);
		const blendedValue = bayesian.value * (1 - progress) + logisticValue * progress;

		return {
			value: blendedValue,
			method: "mixed",
			confidence: bayesian.confidence * 0.5 + progress * 0.5,
			turnNumber,
		};
	}

	/**
	 * Predict health using logistic regression.
	 */
	private logisticPredict(signals: SignalMeasurement[]): number {
		let sum = this.bias;

		for (const signal of signals) {
			const weight = this.weights[signal.type] ?? 0;
			sum += weight * signal.value;
		}

		// Sigmoid
		return 1 / (1 + Math.exp(-sum));
	}

	/**
	 * Update logistic weights using online SGD.
	 */
	private updateLogisticWeights(
		signals: SignalMeasurement[],
		target: number,
	): void {
		const predicted = this.logisticPredict(signals);
		const error = target - predicted;
		const learningRate = 0.01;

		for (const signal of signals) {
			if (this.weights[signal.type] !== undefined) {
				this.weights[signal.type] += learningRate * error * signal.value;
			}
		}
		this.bias += learningRate * error;
	}

	/**
	 * Get health history.
	 */
	getHistory(): HealthScore[] {
		return [...this.history];
	}
}

export { BayesianHealthEstimator } from "./bayesian.js";