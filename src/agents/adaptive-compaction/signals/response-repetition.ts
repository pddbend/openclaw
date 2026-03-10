import type { SignalMeasurement } from "../types.js";

export type AgentResponse = {
  id: string;
  content: string;
};

export type ResponseRepetitionInput = {
  responses: AgentResponse[];
  /** Number of recent responses to compare. */
  windowSize?: number;
};

export type ResponseRepetitionResult = SignalMeasurement & {
  metadata: {
    maxBleuScore: number;
    comparisonCount: number;
  };
};

/**
 * Calculate response self-repetition using BLEU-4 score.
 * Based on Zhu et al. 2018 (Self-BLEU) and Holtzman et al. 2020.
 * Returns quality_from_repetition = 1.0 - self_repetition.
 */
export function calculateResponseRepetition(
  input: ResponseRepetitionInput,
): ResponseRepetitionResult {
  const { responses, windowSize = 5 } = input;

  if (responses.length <= 1) {
    return {
      type: "response_repetition",
      value: 1.0, // Perfect quality (no repetition possible)
      timestamp: Date.now(),
      metadata: {
        maxBleuScore: 0,
        comparisonCount: 0,
      },
    };
  }

  // Only look at recent responses
  const windowResponses = responses.slice(-windowSize);
  const currentResponse = windowResponses[windowResponses.length - 1];
  const previousResponses = windowResponses.slice(0, -1);

  let maxBleu = 0;

  // Calculate BLEU-4 against each previous response
  for (const prev of previousResponses) {
    const bleu = calculateBleu4(currentResponse.content, prev.content);
    maxBleu = Math.max(maxBleu, bleu);
  }

  // quality_from_repetition = 1.0 - self_repetition
  // self_repetition = max BLEU score against previous responses
  return {
    type: "response_repetition",
    value: 1.0 - maxBleu,
    timestamp: Date.now(),
    metadata: {
      maxBleuScore: maxBleu,
      comparisonCount: previousResponses.length,
    },
  };
}

/**
 * Calculate BLEU-4 score between candidate and reference.
 * Simplified implementation focusing on 4-gram precision.
 */
function calculateBleu4(candidate: string, reference: string): number {
  const candTokens = tokenize(candidate);
  const refTokens = tokenize(reference);

  if (candTokens.length < 4 || refTokens.length < 4) {
    // Fall back to shorter n-gram comparison
    return calculateSimpleOverlap(candTokens, refTokens);
  }

  // Calculate 4-gram precision
  const candGrams = getNgrams(candTokens, 4);
  const refGrams = getNgrams(refTokens, 4);

  const refGramSet = new Set(refGrams);
  let matches = 0;

  for (const gram of candGrams) {
    if (refGramSet.has(gram)) {
      matches++;
    }
  }

  const precision = matches / candGrams.length;

  // Add brevity penalty
  const bp =
    candTokens.length < refTokens.length ? Math.exp(1 - refTokens.length / candTokens.length) : 1;

  return precision * bp;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function getNgrams(tokens: string[], n: number): string[] {
  const grams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    grams.push(tokens.slice(i, i + n).join(" "));
  }
  return grams;
}

function calculateSimpleOverlap(cand: string[], ref: string[]): number {
  if (cand.length === 0) {
    return 0;
  }
  const refSet = new Set(ref);
  const matches = cand.filter((t) => refSet.has(t)).length;
  return matches / cand.length;
}
