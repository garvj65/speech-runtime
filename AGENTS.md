# AGENTS.md

Repository: `garvj65/speech-runtime`

## Operating rule

Work one GitHub issue at a time.

Every implementation task must follow this loop:

1. Start from latest `main`.
2. Verify working directory and remote.
3. Create or confirm the GitHub issue.
4. Create a scoped branch.
5. Make only the requested changes.
6. Run available validation.
7. Review the diff for scope.
8. Commit.
9. Push.
10. Open a pull request to `main`.
11. Stop and report.

Do not merge your own PR unless explicitly instructed in a review/merge task.

## Required repo checks before editing

Run:

```bash
pwd
git status
git remote -v
git branch
git log --oneline --decorate -5
```

Expected working directory:

```txt
/Users/ayushisanwaria/Projects/speech-runtime
```

Expected remote:

```txt
https://github.com/garvj65/speech-runtime.git
```

If the working directory or remote is wrong, stop and report the mismatch.

## Project source of truth

Read these first when relevant:

```txt
docs/speech_runtime_lab_v0.md
docs/speech_runtime_lab_metrics.md
research/speech-runtime-lab/ground_truths.v0.json
```

## Current product scope

Speech Runtime Lab v0 is a multilingual listening-quality benchmark lab for:

* VAD / speech detection
* ASR / STT transcription
* WER/CER transcript quality
* latency measurement
* English, Hindi, and Hinglish test cases

It is not a full voice agent.

## Guardrails

Do not add these unless the current issue explicitly asks for them:

* LLM response generation
* TTS
* telephony
* LiveKit
* Twilio
* database
* Prisma
* raw audio storage
* production runtime code
* GitHub Actions
* CI/CD
* large package/framework setup

Do not fake metrics.

If a value cannot be calculated, return `null` with a reason.

WER, CER, and word accuracy require ground truth.

## Task discipline

Keep PRs small.

Do not combine unrelated tasks.

Do not “improve” docs, architecture, package setup, UI, or providers unless explicitly requested.

If the repo has no package setup, do not invent a large setup just to run tests. Report that build/lint is not available.
