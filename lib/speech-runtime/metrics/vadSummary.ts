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

  if (audioDurationMs == null) {
    warnings.push(
      "Audio duration is unavailable; silence duration and speech ratio were not calculated."
    );
  } else if (!Number.isFinite(audioDurationMs) || audioDurationMs <= 0) {
    warnings.push(
      "Audio duration is invalid; silence duration and speech ratio were not calculated."
    );
  }

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
