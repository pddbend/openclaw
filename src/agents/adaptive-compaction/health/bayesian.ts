import type { HealthScore, SignalMeasurement } from "../types.js";

type BetaDistribution = {
  alpha: number;
  beta: number;
};

type BayesianConfig = {
  /** Prior probability that context is healthy. */
  priorHealthy?: number;
  /** Beta distribution parameters for each signal under healthy condition. */
  healthyDistribution?: BetaDistribution;
  /** Beta distribution parameters for each signal under unhealthy condition. */
  unhealthyDistribution?: BetaDistribution;
};

/**
 * Bayesian health estimator based on Adams & MacKay 2007.
 * Maintains P(healthy | signals) and updates with each turn.
 */
export class BayesianHealthEstimator {
  private pHealthy: number;
  private readonly healthyDist: BetaDistribution;
  private readonly unhealthyDist: BetaDistribution;
  private turnNumber = 0;

  constructor(config: BayesianConfig = {}) {
    this.pHealthy = config.priorHealthy ?? 0.9;
    this.healthyDist = config.healthyDistribution ?? { alpha: 2, beta: 5 };
    this.unhealthyDist = config.unhealthyDistribution ?? { alpha: 5, beta: 2 };
  }

  /**
   * Update the health estimate with new signals.
   * Uses Bayesian update: P(healthy|signals) ∝ P(signals|healthy) * P(healthy)
   */
  update(signals: SignalMeasurement[]): void {
    this.turnNumber++;

    // Calculate likelihood ratio for each signal
    let likelihoodHealthy = 1;
    let likelihoodUnhealthy = 1;

    for (const signal of signals) {
      const pSignalGivenHealthy = this.likelihood(signal.value, this.healthyDist, signal.type);
      const pSignalGivenUnhealthy = this.likelihood(signal.value, this.unhealthyDist, signal.type);

      likelihoodHealthy *= pSignalGivenHealthy;
      likelihoodUnhealthy *= pSignalGivenUnhealthy;
    }

    // Bayesian update
    const pUnhealthy = 1 - this.pHealthy;
    const numerator = likelihoodHealthy * this.pHealthy;
    const denominator = numerator + likelihoodUnhealthy * pUnhealthy;

    this.pHealthy = denominator > 0 ? numerator / denominator : 0.5;
  }

  /**
   * Get current health estimate.
   */
  estimate(): HealthScore {
    return {
      value: this.pHealthy,
      method: "bayesian",
      confidence: this.calculateConfidence(),
      turnNumber: this.turnNumber,
    };
  }

  /**
   * Calculate likelihood of signal value under a Beta distribution.
   * Some signals are "good when low" (distractor_density, user_correction)
   * while others are "good when high" (response_repetition).
   */
  private likelihood(value: number, dist: BetaDistribution, signalType: string): number {
    // Normalize value based on signal semantics
    const normalizedValue = this.normalizeSignalValue(value, signalType);

    // Beta PDF approximation
    const { alpha, beta } = dist;
    const pdf = this.betaPdf(normalizedValue, alpha, beta);

    return pdf;
  }

  /**
   * Normalize signal value based on whether high or low is "healthy".
   */
  private normalizeSignalValue(value: number, signalType: string): number {
    // Signals where HIGH value indicates health
    const highIsHealthy = new Set([
      "response_repetition", // quality_from_repetition = 1 - repetition
    ]);

    if (highIsHealthy.has(signalType)) {
      return value; // High already means healthy
    } else {
      // For signals where LOW value indicates health, invert
      // (distractor_density, semantic_confusion, positional_risk, user_correction)
      return 1 - value;
    }
  }

  /**
   * Beta probability density function.
   */
  private betaPdf(x: number, alpha: number, beta: number): number {
    if (x <= 0 || x >= 1) {
      return 0.001;
    } // Small epsilon at boundaries

    // Simplified Beta PDF: x^(α-1) * (1-x)^(β-1)
    // Normalized by B(α,β) which we approximate
    const numerator = Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1);

    // Approximate B(α,β) using Stirling's approximation
    const logBeta = this.logBeta(alpha, beta);
    const denominator = Math.exp(-logBeta);

    return Math.max(0.001, numerator * denominator);
  }

  /**
   * Log of Beta function using Stirling's approximation.
   */
  private logBeta(a: number, b: number): number {
    const logGamma = (x: number): number => {
      // Stirling's approximation for log(Γ(x))
      return (
        (x - 0.5) * Math.log(x) -
        x +
        0.5 * Math.log(2 * Math.PI) +
        1 / (12 * x) -
        1 / (360 * Math.pow(x, 3))
      );
    };

    return logGamma(a) + logGamma(b) - logGamma(a + b);
  }

  /**
   * Calculate confidence based on how much evidence we've seen.
   */
  private calculateConfidence(): number {
    // More turns = higher confidence
    return Math.min(1.0, 0.3 + this.turnNumber * 0.1);
  }
}
