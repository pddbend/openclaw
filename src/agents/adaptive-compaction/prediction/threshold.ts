import type { DynamicThreshold } from "../types.js";
import { GaussianProcessRegressor } from "./gaussian-process.js";

type ThresholdInput = {
  gp: GaussianProcessRegressor;
  taskVulnerability: number;
  currentAmplifier: number;
  baseQualityMin?: number;
  qualityAdjustmentFactor?: number;
};

// Z-scores for different confidence levels
const Z_SCORES = {
  high: 1.645, // 95% confidence (conservative)
  medium: 1.282, // 90% confidence
  low: 0.842, // 80% confidence (aggressive)
};

/**
 * Calculate dynamic compaction threshold using GP predictions.
 */
export function calculateDynamicThreshold(input: ThresholdInput): DynamicThreshold {
  const {
    gp,
    taskVulnerability,
    currentAmplifier,
    baseQualityMin = 0.7,
    qualityAdjustmentFactor = 0.2,
  } = input;

  // Step 1: Determine quality minimum based on task vulnerability
  const qualityMin = baseQualityMin * (1 + taskVulnerability * qualityAdjustmentFactor);

  // Step 2: Determine risk tolerance (z-score) based on vulnerability
  let z: number;
  if (taskVulnerability > 0.7) {
    z = Z_SCORES.high;
  } else if (taskVulnerability > 0.3) {
    z = Z_SCORES.medium;
  } else {
    z = Z_SCORES.low;
  }

  // Step 3: Find critical effective load where lower_bound < qualityMin
  const effectiveLoadCritical = findCriticalEffectiveLoad(gp, qualityMin, z);

  // Step 4: Convert to raw usage threshold
  const rawUsageThreshold = effectiveLoadCritical / currentAmplifier;

  return {
    rawUsageThreshold: Math.min(1, Math.max(0.1, rawUsageThreshold)),
    effectiveLoadCritical,
    confidenceLevel: getConfidenceLevel(z),
    riskTolerance: z,
  };
}

/**
 * Find the effective load where lower_bound(u) < qualityMin.
 * Binary search for efficiency.
 */
function findCriticalEffectiveLoad(
  gp: GaussianProcessRegressor,
  qualityMin: number,
  z: number,
): number {
  const observations = gp.getObservations();

  // If we have data, search around observed range
  const maxObserved = observations.length > 0 ? Math.max(...observations.map((o) => o.x)) : 0.2;

  // Binary search between max observed and 1.0
  let lo = maxObserved;
  let hi = 1.0;

  // If already below threshold at start, return low value
  const predLow = gp.predict(lo);
  if (lowerBound(predLow.mean, predLow.variance, z) < qualityMin) {
    return Math.max(0.1, lo);
  }

  // Binary search for critical point
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const pred = gp.predict(mid);
    const lb = lowerBound(pred.mean, pred.variance, z);

    if (lb < qualityMin) {
      hi = mid;
    } else {
      lo = mid;
    }

    if (hi - lo < 0.001) {
      break;
    }
  }

  // Return the conservative (lower) bound
  return Math.max(0.1, lo);
}

/**
 * Calculate lower confidence bound: μ - z * σ
 */
function lowerBound(mean: number, variance: number, z: number): number {
  const std = Math.sqrt(Math.max(0, variance));
  return mean - z * std;
}

/**
 * Get confidence level percentage from z-score.
 */
function getConfidenceLevel(z: number): number {
  // Approximate: 95% ≈ 1.645, 90% ≈ 1.282, 80% ≈ 0.842
  if (z >= 1.6) {
    return 95;
  }
  if (z >= 1.2) {
    return 90;
  }
  return 80;
}
