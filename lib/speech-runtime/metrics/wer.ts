import type { TranscriptQualityMetrics } from "../types";
import { diffTokens } from "./diff";
import { normalizeTranscript, tokenizeWords } from "./normalizeTranscript";

export function calculateWer(
  expectedTranscript: string | null | undefined,
  predictedTranscript: string
): TranscriptQualityMetrics {
  const normalizedPredictedTranscript = normalizeTranscript(predictedTranscript);

  if (expectedTranscript == null) {
    return emptyQualityResult(
      normalizedPredictedTranscript,
      "Expected transcript is required for transcript quality metrics."
    );
  }

  const normalizedExpectedTranscript = normalizeTranscript(expectedTranscript);

  if (normalizedExpectedTranscript.length === 0) {
    return {
      ...emptyQualityResult(normalizedPredictedTranscript, "Expected transcript is empty."),
      normalizedExpectedTranscript,
    };
  }

  const expectedTokens = tokenizeWords(normalizedExpectedTranscript);
  const predictedTokens = tokenizeWords(normalizedPredictedTranscript);

  if (predictedTokens.length === 0) {
    return {
      normalizedExpectedTranscript,
      normalizedPredictedTranscript,
      wer: 1,
      cer: null,
      wordAccuracy: 0,
      substitutions: 0,
      insertions: 0,
      deletions: expectedTokens.length,
      tokenDiff: expectedTokens.map((expected) => ({
        type: "deletion",
        expected,
        predicted: null,
      })),
      reason: "ASR returned an empty transcript.",
    };
  }

  const tokenDiff = diffTokens(expectedTokens, predictedTokens);
  const substitutions = tokenDiff.filter((operation) => operation.type === "substitution").length;
  const insertions = tokenDiff.filter((operation) => operation.type === "insertion").length;
  const deletions = tokenDiff.filter((operation) => operation.type === "deletion").length;
  const wer = (substitutions + deletions + insertions) / expectedTokens.length;

  return {
    normalizedExpectedTranscript,
    normalizedPredictedTranscript,
    wer,
    cer: null,
    wordAccuracy: Math.max(0, 1 - wer),
    substitutions,
    insertions,
    deletions,
    tokenDiff,
  };
}

function emptyQualityResult(
  normalizedPredictedTranscript: string,
  reason: string
): TranscriptQualityMetrics {
  return {
    normalizedExpectedTranscript: null,
    normalizedPredictedTranscript,
    wer: null,
    cer: null,
    wordAccuracy: null,
    substitutions: null,
    insertions: null,
    deletions: null,
    tokenDiff: [],
    reason,
  };
}
