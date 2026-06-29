import { calculateCer, calculateWer, summarizeVadSegments } from "../lib/speech-runtime/metrics";

const expectedTranscript =
  "Haan, payment link WhatsApp pe bhej do, main shaam tak pay kar dunga.";
const predictedTranscript =
  "Haan payment link WhatsApp pe bhej do main sham tak pay kar dunga";

const wordMetrics = calculateWer(expectedTranscript, predictedTranscript);
const characterErrorRate = calculateCer(expectedTranscript, predictedTranscript);
const vadSummary = summarizeVadSegments({
  audioDurationMs: 4200,
  speechSegments: [
    {
      startMs: 0,
      endMs: 4200,
      durationMs: 4200,
    },
  ],
});

console.log({
  wordMetrics: {
    ...wordMetrics,
    cer: characterErrorRate,
  },
  vadSummary,
});
