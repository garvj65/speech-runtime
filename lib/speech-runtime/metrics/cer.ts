import { normalizeTranscript } from "./normalizeTranscript";

export function calculateCer(
  expectedTranscript: string | null | undefined,
  predictedTranscript: string
): number | null {
  if (expectedTranscript == null) {
    return null;
  }

  const normalizedExpectedTranscript = normalizeTranscript(expectedTranscript);
  const normalizedPredictedTranscript = normalizeTranscript(predictedTranscript);

  if (normalizedExpectedTranscript.length === 0) {
    return null;
  }

  if (normalizedPredictedTranscript.length === 0) {
    return 1;
  }

  const expectedCharacters = Array.from(normalizedExpectedTranscript);
  const predictedCharacters = Array.from(normalizedPredictedTranscript);

  return calculateEditDistance(expectedCharacters, predictedCharacters) / expectedCharacters.length;
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
