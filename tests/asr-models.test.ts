import assert from "node:assert/strict";
import {
  defaultOpenAiTranscriptionModel,
  getOpenAiTranscriptionModel,
  isOpenAiTranscriptionModel,
  openAiTranscriptionModels
} from "../lib/speech-runtime/asr";

assert.deepEqual(openAiTranscriptionModels, [
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
  "whisper-1"
]);

assert.equal(defaultOpenAiTranscriptionModel, "gpt-4o-transcribe");

assert.equal(isOpenAiTranscriptionModel("gpt-4o-transcribe"), true);
assert.equal(isOpenAiTranscriptionModel("gpt-4o-mini-transcribe"), true);
assert.equal(isOpenAiTranscriptionModel("whisper-1"), true);

assert.equal(isOpenAiTranscriptionModel("bad-model"), false);
assert.equal(getOpenAiTranscriptionModel("bad-model"), "gpt-4o-transcribe");
assert.equal(getOpenAiTranscriptionModel(null), "gpt-4o-transcribe");

console.log("ASR model config tests passed.");
