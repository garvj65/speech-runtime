import type { TokenDiffOperation } from "../types";

type EditStep = "match" | "substitution" | "insertion" | "deletion";

type Cell = {
  cost: number;
  step: EditStep | null;
};

type CandidateCell = {
  cost: number;
  step: EditStep;
};

const STEP_PRIORITY: Record<EditStep, number> = {
  match: 0,
  substitution: 1,
  deletion: 2,
  insertion: 3,
};

export function diffTokens(
  expectedTokens: string[],
  predictedTokens: string[]
): TokenDiffOperation[] {
  const rows = expectedTokens.length + 1;
  const columns = predictedTokens.length + 1;
  const matrix: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => ({ cost: 0, step: null }))
  );

  for (let row = 1; row < rows; row += 1) {
    matrix[row][0] = { cost: row, step: "deletion" };
  }

  for (let column = 1; column < columns; column += 1) {
    matrix[0][column] = { cost: column, step: "insertion" };
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const diagonalStep =
        expectedTokens[row - 1] === predictedTokens[column - 1]
          ? "match"
          : "substitution";
      const candidates: CandidateCell[] = [
        {
          cost: matrix[row - 1][column - 1].cost + (diagonalStep === "match" ? 0 : 1),
          step: diagonalStep,
        },
        {
          cost: matrix[row - 1][column].cost + 1,
          step: "deletion",
        },
        {
          cost: matrix[row][column - 1].cost + 1,
          step: "insertion",
        },
      ];

      const bestCandidate = candidates.sort((left, right) => {
        if (left.cost !== right.cost) {
          return left.cost - right.cost;
        }

        return STEP_PRIORITY[left.step] - STEP_PRIORITY[right.step];
      })[0];

      matrix[row][column] = bestCandidate;
    }
  }

  const operations: TokenDiffOperation[] = [];
  let row = expectedTokens.length;
  let column = predictedTokens.length;

  while (row > 0 || column > 0) {
    const step = matrix[row][column].step;

    if (step === "match") {
      operations.push({
        type: "match",
        expected: expectedTokens[row - 1],
        predicted: predictedTokens[column - 1],
      });
      row -= 1;
      column -= 1;
      continue;
    }

    if (step === "substitution") {
      operations.push({
        type: "substitution",
        expected: expectedTokens[row - 1],
        predicted: predictedTokens[column - 1],
      });
      row -= 1;
      column -= 1;
      continue;
    }

    if (step === "deletion") {
      operations.push({
        type: "deletion",
        expected: expectedTokens[row - 1],
        predicted: null,
      });
      row -= 1;
      continue;
    }

    operations.push({
      type: "insertion",
      expected: null,
      predicted: predictedTokens[column - 1],
    });
    column -= 1;
  }

  return operations.reverse();
}
