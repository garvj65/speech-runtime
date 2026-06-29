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
- browser recording UI skeleton

Not implemented yet:

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

## Browser UI

Run the local lab UI:

```bash
npm run dev
```

Build the UI:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

The current UI supports ground-truth selection and local browser recording only. It does not run ASR, VAD, upload, telephony, or provider calls yet.

## Source of truth

- `docs/speech_runtime_lab_v0.md`
- `docs/speech_runtime_lab_metrics.md`
- `research/speech-runtime-lab/ground_truths.v0.json`
