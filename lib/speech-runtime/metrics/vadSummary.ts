import type { SpeechSegment, VadSummaryMetrics } from "../types";

export function summarizeVadSegments(params: {
  audioDurationMs?: number | null;
  speechSegments: SpeechSegment[];
}): VadSummaryMetrics {
  const speechSegments = params.speechSegments;
  const detectedSpeechDurationMs = speechSegments.reduce(
    (total, segment) => total + segment.durationMs,
    0
  );
  const audioDurationMs = params.audioDurationMs;
  const hasValidAudioDuration =
    typeof audioDurationMs === "number" && Number.isFinite(audioDurationMs) && audioDurationMs > 0;
  const warnings: string[] = [];

  if (speechSegments.length === 0) {
    warnings.push("No speech segments detected.");
  }

  if (hasValidAudioDuration && detectedSpeechDurationMs > audioDurationMs) {
    warnings.push("Detected speech duration exceeds audio duration.");
  }

  return {
    speechSegments,
    speechSegmentCount: speechSegments.length,
    detectedSpeechDurationMs,
    detectedSilenceDurationMs: hasValidAudioDuration
      ? audioDurationMs - detectedSpeechDurationMs
      : null,
    speechRatio: hasValidAudioDuration ? detectedSpeechDurationMs / audioDurationMs : null,
    warnings,
  };
}
