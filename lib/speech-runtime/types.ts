export type LanguageMode = "english" | "hindi" | "hinglish";

export type ScriptType = "latin" | "devanagari" | "mixed";

export type NullableMetricReason = {
  value: null;
  reason: string;
};

export type SpeechSegment = {
  startMs: number;
  endMs: number;
  durationMs: number;
};

export type TokenDiffOperation =
  | {
      type: "match";
      expected: string;
      predicted: string;
    }
  | {
      type: "substitution";
      expected: string;
      predicted: string;
    }
  | {
      type: "insertion";
      expected: null;
      predicted: string;
    }
  | {
      type: "deletion";
      expected: string;
      predicted: null;
    };

export type TranscriptQualityMetrics = {
  normalizedExpectedTranscript: string | null;
  normalizedPredictedTranscript: string;
  wer: number | null;
  cer: number | null;
  wordAccuracy: number | null;
  substitutions: number | null;
  insertions: number | null;
  deletions: number | null;
  tokenDiff: TokenDiffOperation[];
  reason?: string;
};

export type VadSummaryMetrics = {
  speechSegments: SpeechSegment[];
  speechSegmentCount: number;
  detectedSpeechDurationMs: number;
  detectedSilenceDurationMs: number | null;
  speechRatio: number | null;
  warnings: string[];
};
