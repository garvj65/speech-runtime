import type { TranscriptQualityMetrics } from "../types";
import { calculateCer } from "./cer";
import { calculateWer } from "./wer";

export function calculateTranscriptQualityMetrics(
  expectedTranscript: string | null | undefined,
  predictedTranscript: string
): TranscriptQualityMetrics {
  const wordMetrics = calculateWer(expectedTranscript, predictedTranscript);
  const characterMetrics = calculateCer(expectedTranscript, predictedTranscript);
  const reason = wordMetrics.reason ?? characterMetrics.reason;
  const transcriptQuality: TranscriptQualityMetrics = {
    ...wordMetrics,
    cer: characterMetrics.cer,
  };

  return reason ? { ...transcriptQuality, reason } : transcriptQuality;
}
