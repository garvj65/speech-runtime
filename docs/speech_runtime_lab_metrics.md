# Speech Runtime Lab v0 — Metrics Spec

Status: Locked v0 metrics source-of-truth
Project: Speech Runtime Lab v0
Recommended repo path: `docs/speech_runtime_lab_metrics.md`

---

## 1. Purpose

This document defines the metrics layer for Speech Runtime Lab v0.

Speech Runtime Lab v0 measures listening quality across:

* VAD / speech detection
* ASR / STT transcription
* transcript quality
* language robustness
* latency
* benchmark repeatability

The metrics layer must be implemented before provider integrations, UI polish, telephony, or runtime configuration expansion.

---

## 2. Metric philosophy

Metrics must be honest.

If a metric cannot be calculated, the system must return `null` with a clear reason instead of inventing a value.

Examples:

```json
{
  "wer": null,
  "reason": "WER requires expectedTranscript, but no ground truth was selected."
}
```

```json
{
  "speechRatio": null,
  "reason": "audioDurationMs is missing or invalid."
}
```

The system must not fake:

* WER
* CER
* confidence
* VAD output
* detected language
* provider latency
* word timestamps
* accuracy

If a provider does not return a value, keep it `null`.

---

## 3. Metric categories

Speech Runtime Lab v0 metrics are grouped into six categories:

1. Ground truth metrics
2. Transcript normalization metrics
3. Transcript quality metrics
4. VAD summary metrics
5. Latency metrics
6. Run metadata metrics

---

## 4. Ground truth metrics

Ground truth is the expected transcript selected before recording or uploading audio.

WER, CER, and word accuracy require ground truth.

If the user records free speech without selecting a ground truth, the system may still show:

* predicted transcript
* provider/model
* VAD output
* audio duration
* latency
* debug metadata

But it must not show WER, CER, or word accuracy as real values.

---

## 5. Ground truth fields

### 5.1 selectedGroundTruthId

The ID of the selected ground truth item.

Example:

```json
{
  "selectedGroundTruthId": "truth_008"
}
```

If no ground truth is selected:

```json
{
  "selectedGroundTruthId": null
}
```

### 5.2 expectedTranscript

The canonical expected transcript from the selected ground truth.

Example:

```json
{
  "expectedTranscript": "Haan, payment link WhatsApp pe bhej do, main shaam tak pay kar dunga."
}
```

### 5.3 languageMode

Allowed values:

```txt
english
hindi
hinglish
```

### 5.4 scriptType

Allowed values:

```txt
latin
devanagari
mixed
```

v0 canonical script rules:

* English uses `latin`
* Hindi uses `devanagari`
* Hinglish uses `latin`

---

## 6. Predicted transcript fields

### 6.1 predictedTranscript

The transcript returned by ASR/STT.

Example:

```json
{
  "predictedTranscript": "Haan payment link WhatsApp pe bhej do main sham tak pay kar dunga"
}
```

### 6.2 languageDetected

Detected language returned by a provider.

This is provider-dependent.

If unavailable:

```json
{
  "languageDetected": null
}
```

### 6.3 confidence

Overall transcript confidence returned by a provider.

This is provider-dependent.

If unavailable:

```json
{
  "confidence": null
}
```

Do not generate fake confidence.

---

## 7. Transcript normalization

Transcript normalization prepares expected and predicted transcripts for comparison.

v0 normalization is intentionally simple.

### 7.1 v0 normalization rules

The function `normalizeTranscript(input)` must:

* handle empty strings safely
* trim whitespace
* lowercase Latin text
* remove common punctuation
* collapse repeated spaces
* preserve Devanagari characters
* preserve digits
* preserve alphanumeric tokens
* avoid transliteration

### 7.2 Punctuation removal

Remove common punctuation such as:

```txt
. , ? ! : ; " ' ( ) [ ] { }
```

Also normalize common Devanagari punctuation such as:

```txt
। ॥
```

into spacing/removal as appropriate.

### 7.3 Whitespace normalization

Multiple spaces, tabs, and newlines should become one space.

Example:

```txt
Input:
"Haan,   payment link WhatsApp pe bhej do."

Output:
"haan payment link whatsapp pe bhej do"
```

### 7.4 Hindi and Hinglish limitations

Do not transliterate in v0.

Do not convert:

```txt
मुझे
```

to:

```txt
mujhe
```

Do not convert:

```txt
mujhe
```

to:

```txt
मुझे
```

This means raw WER may be high when expected and predicted scripts differ.

That is acceptable for v0.

Future versions may add:

* transliteration
* spelling normalization
* number normalization
* business entity normalization
* semantic transcript similarity

---

## 8. Word tokenization

The function `tokenizeWords(input)` should:

1. Normalize the transcript.
2. Split on spaces.
3. Remove empty tokens.
4. Return an ordered string array.

Example:

```txt
Input:
"Haan, payment link WhatsApp pe bhej do."

Tokens:
["haan", "payment", "link", "whatsapp", "pe", "bhej", "do"]
```

---

## 9. Token diff

The token diff powers both WER calculation and the future dashboard diff view.

The function `diffTokens(expectedTokens, predictedTokens)` must return an ordered list of operations.

Allowed operation types:

```txt
match
substitution
insertion
deletion
```

### 9.1 Match

Expected and predicted tokens are the same.

```json
{
  "type": "match",
  "expected": "haan",
  "predicted": "haan"
}
```

### 9.2 Substitution

Expected token was replaced by a different predicted token.

```json
{
  "type": "substitution",
  "expected": "shaam",
  "predicted": "sham"
}
```

### 9.3 Insertion

Predicted transcript contains an extra token.

```json
{
  "type": "insertion",
  "expected": null,
  "predicted": "me"
}
```

### 9.4 Deletion

Expected token was missed by ASR.

```json
{
  "type": "deletion",
  "expected": "whatsapp",
  "predicted": null
}
```

### 9.5 Alignment algorithm

Use dynamic programming / Levenshtein alignment.

The implementation should prefer stable, readable output over clever heuristics.

---

## 10. WER — Word Error Rate

WER measures transcript error at the word level.

Formula:

```txt
WER = (S + D + I) / N
```

Where:

* `S` = substitutions
* `D` = deletions
* `I` = insertions
* `N` = number of words in the expected transcript

Lower is better.

### 10.1 Example

Expected:

```txt
haan payment link whatsapp pe bhej do
```

Predicted:

```txt
haan payment link whatsapp par bhej do
```

Diff:

```txt
pe → par
```

Counts:

```txt
S = 1
D = 0
I = 0
N = 7
```

WER:

```txt
1 / 7 = 0.1429
```

### 10.2 Missing ground truth

If expected transcript is missing:

```json
{
  "wer": null,
  "reason": "WER requires expectedTranscript."
}
```

### 10.3 Empty expected transcript

If expected transcript is empty:

```json
{
  "wer": null,
  "reason": "Expected transcript is empty."
}
```

### 10.4 Empty predicted transcript

If expected transcript exists but predicted transcript is empty:

```json
{
  "wer": 1,
  "wordAccuracy": 0,
  "substitutions": 0,
  "insertions": 0,
  "deletions": "<expected token count>"
}
```

---

## 11. Word accuracy

Word accuracy is derived from WER.

Formula:

```txt
wordAccuracy = max(0, 1 - WER)
```

WER can be greater than 1 when there are many insertions.

Therefore word accuracy must never go below 0.

Example:

```json
{
  "wer": 0.1429,
  "wordAccuracy": 0.8571
}
```

---

## 12. CER — Character Error Rate

CER measures transcript error at the character level.

Formula:

```txt
CER = character edit distance / number of characters in expected transcript
```

CER is useful when:

* spelling differs slightly
* Hinglish romanization differs slightly
* Hindi character-level differences matter
* WER marks a full word wrong but the word is only slightly misspelled

Example:

```txt
Expected:
shaam

Predicted:
sham
```

WER may treat this as one wrong word. CER shows it is a smaller character-level error.

### 12.1 CER null rules

If expected transcript is missing or empty:

```json
{
  "cer": null,
  "reason": "CER requires non-empty expectedTranscript."
}
```

If predicted transcript is empty and expected transcript exists:

```json
{
  "cer": 1
}
```

---

## 13. Transcript quality result shape

The function `calculateWer(expectedTranscript, predictedTranscript)` should return a result shaped like this:

```json
{
  "normalizedExpectedTranscript": "haan payment link whatsapp pe bhej do main shaam tak pay kar dunga",
  "normalizedPredictedTranscript": "haan payment link whatsapp pe bhej do main sham tak pay kar dunga",
  "wer": 0.0833,
  "cer": null,
  "wordAccuracy": 0.9167,
  "substitutions": 1,
  "insertions": 0,
  "deletions": 0,
  "tokenDiff": [
    {
      "type": "match",
      "expected": "haan",
      "predicted": "haan"
    },
    {
      "type": "substitution",
      "expected": "shaam",
      "predicted": "sham"
    }
  ]
}
```

If no expected transcript exists:

```json
{
  "normalizedExpectedTranscript": null,
  "normalizedPredictedTranscript": "free speech transcript",
  "wer": null,
  "cer": null,
  "wordAccuracy": null,
  "substitutions": null,
  "insertions": null,
  "deletions": null,
  "tokenDiff": [],
  "reason": "Expected transcript is required for transcript quality metrics."
}
```

---

## 14. VAD summary metrics

VAD summary metrics describe detected speech regions.

The VAD summary utility does not run VAD itself.

It only summarizes already-provided speech segment metadata.

### 14.1 speechSegments

Detected speech regions in milliseconds.

Example:

```json
{
  "speechSegments": [
    {
      "startMs": 320,
      "endMs": 3900,
      "durationMs": 3580
    }
  ]
}
```

### 14.2 speechSegmentCount

Number of detected speech segments.

```json
{
  "speechSegmentCount": 1
}
```

### 14.3 detectedSpeechDurationMs

Sum of all speech segment durations.

```json
{
  "detectedSpeechDurationMs": 3580
}
```

### 14.4 detectedSilenceDurationMs

Formula:

```txt
detectedSilenceDurationMs = audioDurationMs - detectedSpeechDurationMs
```

If audio duration is unavailable, return `null`.

### 14.5 speechRatio

Formula:

```txt
speechRatio = detectedSpeechDurationMs / audioDurationMs
```

If audio duration is missing, zero, or invalid, return `null`.

### 14.6 VAD warnings

Return warnings for suspicious VAD summaries.

Examples:

```json
{
  "warnings": ["No speech segments detected."]
}
```

```json
{
  "warnings": ["Detected speech duration exceeds audio duration."]
}
```

---

## 15. Latency metrics

Latency metrics describe when each part of the listening pipeline happened.

v0 may not fill every latency field immediately, but the result shape should anticipate them.

### 15.1 ASR latency fields

* `asrRequestStartedAt`
* `asrResponseReceivedAt`
* `asrProviderLatencyMs`
* `transcriptFinalizedAt`

Formula:

```txt
asrProviderLatencyMs = asrResponseReceivedAt - asrRequestStartedAt
```

In non-streaming v0:

```txt
transcriptFinalizedAt = asrResponseReceivedAt
```

### 15.2 VAD latency fields

* `vadStartedAt`
* `vadCompletedAt`
* `vadProcessingLatencyMs`

Formula:

```txt
vadProcessingLatencyMs = vadCompletedAt - vadStartedAt
```

### 15.3 Total pipeline latency fields

* `recordingStartedAt`
* `recordingStoppedAt`
* `audioBlobCreatedAt`
* `uploadStartedAt`
* `serverReceivedAt`
* `metricsComputedAt`
* `clientResultReceivedAt`

Derived backend latency:

```txt
backendPipelineLatencyMs = metricsComputedAt - serverReceivedAt
```

Derived user-visible latency:

```txt
clientEndToResultLatencyMs = clientResultReceivedAt - recordingStoppedAt
```

---

## 16. Audio metadata

Minimum v0 audio metadata:

```json
{
  "audio": {
    "source": "browser_recording",
    "mimeType": "audio/webm",
    "durationMs": 4200,
    "sizeBytes": 58241
  }
}
```

Future fields:

```json
{
  "sampleRateHz": 16000,
  "channels": 1,
  "codec": "opus",
  "telephonyProvider": null,
  "callId": null
}
```

Do not invent future values.

Use `null` when unavailable.

---

## 17. Full result object shape

A future run result should look like this:

```json
{
  "runId": "asr_run_001",
  "createdAt": "2026-06-29T00:00:00.000Z",
  "groundTruth": {
    "id": "truth_008",
    "languageMode": "hinglish",
    "scriptType": "latin",
    "expectedTranscript": "Haan, payment link WhatsApp pe bhej do, main shaam tak pay kar dunga."
  },
  "audio": {
    "source": "browser_recording",
    "mimeType": "audio/webm",
    "durationMs": 4200,
    "sizeBytes": 58241
  },
  "vad": {
    "provider": "none",
    "config": {
      "mode": "none"
    },
    "speechSegments": [
      {
        "startMs": 0,
        "endMs": 4200,
        "durationMs": 4200
      }
    ],
    "speechSegmentCount": 1,
    "detectedSpeechDurationMs": 4200,
    "detectedSilenceDurationMs": 0,
    "speechRatio": 1,
    "processingLatencyMs": 0,
    "warnings": []
  },
  "asr": {
    "provider": "openai",
    "model": "gpt-4o-mini-transcribe",
    "predictedTranscript": "Haan payment link WhatsApp pe bhej do main sham tak pay kar dunga",
    "languageDetected": null,
    "confidence": null,
    "providerLatencyMs": 780
  },
  "quality": {
    "normalizedExpectedTranscript": "haan payment link whatsapp pe bhej do main shaam tak pay kar dunga",
    "normalizedPredictedTranscript": "haan payment link whatsapp pe bhej do main sham tak pay kar dunga",
    "wer": 0.0833,
    "cer": 0.0142,
    "wordAccuracy": 0.9167,
    "substitutions": 1,
    "insertions": 0,
    "deletions": 0,
    "tokenDiff": []
  },
  "latency": {
    "backendPipelineLatencyMs": 850,
    "clientEndToResultLatencyMs": 1230,
    "vadProcessingLatencyMs": 0,
    "asrProviderLatencyMs": 780
  }
}
```

---

## 18. Null metric rules

### 18.1 No expected transcript

```json
{
  "wer": null,
  "cer": null,
  "wordAccuracy": null,
  "reason": "Expected transcript is required for transcript quality metrics."
}
```

### 18.2 Empty expected transcript

```json
{
  "wer": null,
  "cer": null,
  "wordAccuracy": null,
  "reason": "Expected transcript is empty."
}
```

### 18.3 Empty predicted transcript

```json
{
  "wer": 1,
  "cer": 1,
  "wordAccuracy": 0,
  "reason": "ASR returned an empty transcript."
}
```

### 18.4 Missing audio duration

```json
{
  "speechRatio": null,
  "detectedSilenceDurationMs": null,
  "reason": "Audio duration is unavailable."
}
```

### 18.5 VAD failed

```json
{
  "speechSegments": [],
  "speechSegmentCount": 0,
  "detectedSpeechDurationMs": 0,
  "warnings": ["VAD failed or returned no speech segments."]
}
```

---

## 19. v0 implementation priority

Implement metrics in this order:

1. Transcript normalization
2. Word tokenization
3. Token diff
4. WER
5. CER
6. Word accuracy
7. VAD summary metrics
8. Shared TypeScript result types
9. Example usage file

Do not implement provider calls in this task.

Do not implement UI in this task.

---

## 20. Non-goals for metrics task

Do not add:

* OpenAI integration
* Deepgram integration
* Silero integration
* WebRTC VAD integration
* browser recording
* React UI
* Next.js app
* database
* Prisma
* telephony
* audio file processing
* raw audio storage
* CI/CD
* GitHub Actions

This task is only:

```txt
metrics spec
+ pure transcript utilities
+ pure VAD summary utility
+ example usage
```

---

## 21. Acceptance criteria

Task 2 is complete when:

* `docs/speech_runtime_lab_metrics.md` exists.
* `lib/speech-runtime/types.ts` exists.
* `normalizeTranscript` exists.
* `tokenizeWords` exists.
* `diffTokens` exists.
* `calculateWer` exists.
* `calculateCer` exists.
* `summarizeVadSegments` exists.
* metric helpers are exported from `lib/speech-runtime/metrics/index.ts`.
* an example file exists under `examples/`.
* no ASR provider integration is added.
* no VAD provider integration is added.
* no UI is added.
* no API route is added.
* no database or app framework setup is added.
* available local validation is run and reported.
