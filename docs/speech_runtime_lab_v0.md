# Speech Runtime Lab v0 — Project Definition

Status: Locked v0 source-of-truth for Codex  
Owner: Garv / Truffl research lane  
Product context: Truffl Runtime Config Workbench  
Recommended repo path: `docs/speech_runtime_lab_v0.md`

---

## 1. Project name

**Speech Runtime Lab v0**

Earlier names like ASR Lab are too narrow. This project tests both:

- VAD / speech detection
- ASR / STT transcription

The project is about listening quality, not full agent behavior.

---

## 2. One-line definition

Speech Runtime Lab v0 is a multilingual benchmark lab that records or receives audio, runs it through configurable VAD and ASR/STT providers, compares transcripts against known ground truth, and reports WER, CER, latency, speech-detection behavior, and language robustness for English, Hindi, and Hinglish.

---

## 3. Core product question

Which VAD + ASR configuration listens best for this language, audio condition, customer segment, and workflow?

---

## 4. Why this exists

A voice agent cannot perform well if it cannot listen correctly.

Before optimizing LLM prompts, TTS, telephony, or full conversation behavior, Truffl needs a reliable way to measure:

- Did the system detect speech correctly?
- Did it send the right audio segment to ASR?
- Did ASR transcribe the user correctly?
- Did the system handle English, Hindi, and Hinglish?
- How long did VAD + ASR take?
- Which provider/model/configuration worked best?

This project becomes the listening-quality test bench inside Truffl’s Runtime Config Workbench.

---

## 5. Languages in scope

Primary languages for v0:

1. English
2. Hindi
3. Hinglish

Canonical script rules:

- English ground truth uses Latin script.
- Hindi ground truth uses Devanagari script.
- Hinglish ground truth uses Roman/Latin script.
- Mixed Hindi + English business terms are allowed.
- Raw WER is calculated against the canonical expected transcript.
- Normalized WER can be added later for cross-script comparison.

---

## 6. v0 pipeline

The target v0 pipeline is:

```txt
browser-recorded audio
→ optional VAD processing
→ ASR/STT transcription
→ transcript normalization
→ ground-truth comparison
→ metrics calculation
→ dashboard/result JSON
```

The future pipeline should also support:

```txt
telephony audio
→ same VAD + ASR + metrics pipeline
```

Telephony is not part of the first implementation slice.

---

## 7. Audio sources

v0 source:

- Browser recording through web UI.

Later sources:

- Uploaded audio file.
- Telephony call audio.
- LiveKit/Twilio/Plivo media stream or recording.
- Pre-recorded benchmark audio set.

v0 should not require telephony to work.

---

## 8. Ground truth requirement

WER and CER require ground truth.

If a user records free speech without selecting an expected transcript, the system may show:

- transcript
- provider/model
- audio duration
- VAD output
- latency
- debug metadata

But it must not claim WER, CER, or word accuracy.

v0 starts with 10 fixed ground-truth scripts stored in:

```txt
research/speech-runtime-lab/ground_truths.v0.json
```

---

## 9. VAD requirements

VAD is a first-class component of this project.

VAD decides:

- where speech starts
- where speech ends
- which audio segment is passed to ASR
- whether silence/background noise is ignored
- how much speech duration is detected

v0 VAD modes:

1. `none`

   - Send full recorded audio directly to ASR.
   - Useful baseline.

2. `silero`

   - First real VAD provider.
   - Should be implemented behind a VAD provider interface.

Future VAD providers should be pluggable:

- Silero
- WebRTC VAD
- provider-native VAD
- telephony/provider endpointing
- future Truffl custom VAD

Do not hardcode project logic around one VAD provider.

---

## 10. ASR/STT requirements

ASR/STT is also provider-based.

v0 may start with one ASR provider, but the implementation must use an adapter interface so additional providers can be added later.

Future ASR providers may include:

- OpenAI
- Deepgram
- Google
- Azure
- Sarvam
- Whisper local
- faster-whisper
- other Indic/Hinglish-focused providers

Do not hardcode UI or metrics logic to one ASR provider.

---

## 11. Minimum v0 metrics

ASR metrics:

- transcript
- WER, only when ground truth exists
- CER, only when ground truth exists
- word accuracy, only when ground truth exists
- substitutions
- insertions
- deletions
- ASR provider latency
- ASR model/provider metadata

VAD metrics:

- VAD provider
- VAD mode/config
- detected speech start
- detected speech end
- detected speech duration
- detected silence duration
- number of speech segments
- VAD processing latency

Combined metrics:

- audio duration
- total pipeline latency
- selected language mode
- selected ground truth ID
- VAD + ASR configuration used
- result timestamp

---

## 12. v0 benchmark matrix

Do not start with too many combinations.

Initial benchmark matrix:

```txt
10 ground truths
× 2 VAD modes: none, silero
× 1 ASR provider
= 20 initial test runs
```

This is enough to prove whether the pipeline works.

Only after this is stable should we add more ASR providers or VAD providers.

---

## 13. v0 UI requirements

The v0 dashboard should show:

- ground-truth selector
- expected transcript
- language mode
- VAD mode selector
- ASR provider/model selector
- browser recorder
- transcript output
- VAD result summary
- WER/CER/accuracy cards, only when ground truth exists
- latency cards
- word diff view
- JSON result/debug view

The UI can be simple. Correctness matters more than polish.

---

## 14. v0 non-goals

Do not build these in v0:

- full voice agent
- LLM response generation
- TTS
- LiveKit/telephony integration
- streaming STT
- production phone runtime
- 30-provider benchmark dashboard
- custom VAD model training
- automatic semantic turn detection
- raw audio storage in database
- Runtime Config Builder integration
- fake confidence values
- fake WER without ground truth

---

## 15. Suggested repo paths

Documentation:

```txt
docs/speech_runtime_lab_v0.md
docs/speech_runtime_lab_metrics.md
```

Data:

```txt
research/speech-runtime-lab/ground_truths.v0.json
```

Future implementation paths:

```txt
app/(builder)/speech-runtime-lab/page.tsx

lib/speech-runtime/
  types.ts
  metrics/
    wer.ts
    cer.ts
    diff.ts
    normalizeTranscript.ts
  vad/
    VadProvider.ts
    noneVadProvider.ts
    sileroVadProvider.ts
  asr/
    AsrProvider.ts
    openaiAsrProvider.ts
```

---

## 16. Codex implementation rules

Codex must follow these rules:

1. Keep this project isolated from the production runtime at first.
2. Do not modify `components/Chat.tsx` unless explicitly instructed.
3. Do not modify existing `/api/stt` unless explicitly instructed.
4. Do not modify Prisma schema in the first implementation slice.
5. Do not add telephony in v0.
6. Do not fake VAD, ASR, confidence, or WER metrics.
7. If a metric cannot be calculated, return `null` and explain why.
8. WER/CER must only be calculated when expected transcript exists.
9. Keep Hindi, Hinglish, and English test cases separate and tagged.
10. Keep provider interfaces pluggable from the beginning.

---

## 17. Definition of done for v0 planning

Planning is complete when these files exist:

```txt
docs/speech_runtime_lab_v0.md
research/speech-runtime-lab/ground_truths.v0.json
```

The next step after that is to define metrics utilities, not to build the full UI immediately.
