import type { CerMetricResult } from "../types";
import { normalizeTranscript } from "./normalizeTranscript";

export function calculateCer(
  expectedTranscript: string | null | undefined,
  predictedTranscript: string
): CerMetricResult {
  const normalizedPredictedTranscript = normalizeTranscript(predictedTranscript);

  if (expectedTranscript == null) {
    return {
      cer: null,
      normalizedExpectedTranscript: null,
      normalizedPredictedTranscript,
      reason: "Expected transcript is required for CER.",
    };
  }

  const normalizedExpectedTranscript = normalizeTranscript(expectedTranscript);

  if (normalizedExpectedTranscript.length === 0) {
    return {
      cer: null,
      normalizedExpectedTranscript,
      normalizedPredictedTranscript,
      reason: "Expected transcript is empty.",
    };
  }

  if (normalizedPredictedTranscript.length === 0) {
    return {
      cer: 1,
      normalizedExpectedTranscript,
      normalizedPredictedTranscript,
      reason: "ASR returned an empty transcript.",
    };
  }

  const expectedCharacters = Array.from(normalizedExpectedTranscript);
  const predictedCharacters = Array.from(normalizedPredictedTranscript);

  return {
    cer: calculateEditDistance(expectedCharacters, predictedCharacters) / expectedCharacters.length,
    normalizedExpectedTranscript,
    normalizedPredictedTranscript,
  };
}

function calculateEditDistance(expected: string[], predicted: string[]): number {
  const rows = expected.length + 1;
  const columns = predicted.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => 0)
  );

  for (let row = 1; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 1; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost = expected[row - 1] === predicted[column - 1] ? 0 : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost
      );
    }
  }

  return matrix[expected.length][predicted.length];
}
