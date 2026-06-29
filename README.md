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
- local OpenAI ASR transcription path
- server-side WER/CER metrics against selected ground truth

Not implemented yet:

- VAD provider integrations
- telephony

## Setup

```bash
npm install
```

## Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Set:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe
API_PORT=8787
```

Never commit `.env`.

## Validation

```bash
npm run typecheck
npm run example:metrics
npm run test:metrics
npm test
npm run build
```

## Browser UI

Run both the local API server and browser UI:

```bash
npm run dev
```

The UI runs on `http://127.0.0.1:5173/`.

The local API server runs on `http://127.0.0.1:8787/`.

The browser sends recorded audio to the local API server. The OpenAI API key
stays server-side.

Build the UI:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

The current UI supports ground-truth selection, local browser recording, and
server-side OpenAI transcription with WER/CER metrics against the selected
ground truth. It does not run VAD, telephony, or streaming STT yet.

## Source of truth

- `docs/speech_runtime_lab_v0.md`
- `docs/speech_runtime_lab_metrics.md`
- `research/speech-runtime-lab/ground_truths.v0.json`
