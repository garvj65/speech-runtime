import assert from "node:assert/strict";
import {
  calculateCer,
  calculateTranscriptQualityMetrics,
  calculateWer,
  normalizeTranscript,
  summarizeVadSegments,
  tokenizeWords,
} from "../lib/speech-runtime/metrics";

const normalized = normalizeTranscript("Haan, payment link WhatsApp pe bhej do.");
assert.equal(normalized, "haan payment link whatsapp pe bhej do");

const tokens = tokenizeWords("Haan, payment link WhatsApp pe bhej do.");
assert.deepEqual(tokens, ["haan", "payment", "link", "whatsapp", "pe", "bhej", "do"]);

const wer = calculateWer(
  "haan payment link whatsapp pe bhej do",
  "haan payment link whatsapp par bhej do"
);
assert.equal(wer.substitutions, 1);
assert.equal(wer.insertions, 0);
assert.equal(wer.deletions, 0);
assert.ok(wer.wer !== null);
assert.ok(Math.abs(wer.wer - 1 / 7) < 0.0001);

const missingCer = calculateCer(null, "free speech");
assert.equal(missingCer.cer, null);
assert.ok(missingCer.reason);

const validCer = calculateCer("shaam", "sham");
assert.equal(typeof validCer.cer, "number");

const transcriptQuality = calculateTranscriptQualityMetrics(
  "haan payment link whatsapp pe bhej do",
  "haan payment link whatsapp par bhej do"
);
assert.equal(transcriptQuality.substitutions, 1);
assert.ok(transcriptQuality.wer !== null);
assert.ok(Math.abs(transcriptQuality.wer - 1 / 7) < 0.0001);
assert.equal(typeof transcriptQuality.cer, "number");
assert.equal(
  transcriptQuality.tokenDiff.filter(
    (operation) => operation.type === "substitution"
  ).length,
  1
);

const missingExpectedQuality = calculateTranscriptQualityMetrics(
  null,
  "free speech"
);
assert.equal(missingExpectedQuality.wer, null);
assert.equal(missingExpectedQuality.cer, null);
assert.ok(missingExpectedQuality.reason);

const emptyExpectedQuality = calculateTranscriptQualityMetrics("", "free speech");
assert.equal(emptyExpectedQuality.wer, null);
assert.equal(emptyExpectedQuality.cer, null);
assert.ok(emptyExpectedQuality.reason);

const fullVad = summarizeVadSegments({
  audioDurationMs: 4200,
  speechSegments: [{ startMs: 0, endMs: 4200, durationMs: 4200 }],
});
assert.equal(fullVad.speechSegmentCount, 1);
assert.equal(fullVad.detectedSpeechDurationMs, 4200);
assert.equal(fullVad.detectedSilenceDurationMs, 0);
assert.equal(fullVad.speechRatio, 1);

const missingDurationVad = summarizeVadSegments({
  speechSegments: [{ startMs: 0, endMs: 1000, durationMs: 1000 }],
});
assert.equal(missingDurationVad.speechRatio, null);
assert.ok(
  missingDurationVad.warnings.some((warning) =>
    warning.includes("Audio duration is unavailable")
  )
);

console.log("metrics smoke test passed");
