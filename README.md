# Speech Runtime

Speech Runtime Lab v0 is a multilingual listening-quality benchmark lab for testing VAD and ASR/STT behavior across English, Hindi, and Hinglish.

## Current status

Implemented so far:

- project definition
- multilingual ground-truth JSON
- metrics spec
- pure transcript metrics utilities
- VAD summary utility
- TypeScript validation harness

Not implemented yet:

- browser recording UI
- ASR provider integrations
- VAD provider integrations
- API routes
- telephony

## Setup

```bash
npm install
```

## Validation

```bash
npm run typecheck
npm run example:metrics
npm run test:metrics
npm test
```

## Source of truth

- `docs/speech_runtime_lab_v0.md`
- `docs/speech_runtime_lab_metrics.md`
- `research/speech-runtime-lab/ground_truths.v0.json`
