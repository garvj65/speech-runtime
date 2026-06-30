import assert from "node:assert/strict";
import { getOpenAiTranscriptionHints } from "../lib/speech-runtime/asr";

const english = getOpenAiTranscriptionHints("english");
assert.equal(english.language, "en");
assert.ok(english.prompt?.toLowerCase().includes("english"));

const hindi = getOpenAiTranscriptionHints("hindi");
assert.equal(hindi.language, "hi");
assert.ok(hindi.prompt?.toLowerCase().includes("hindi"));

const hinglish = getOpenAiTranscriptionHints("hinglish");
assert.equal(hinglish.language, null);
assert.ok(hinglish.prompt?.toLowerCase().includes("hinglish"));

const unknown = getOpenAiTranscriptionHints("unknown");
assert.equal(unknown.language, null);
assert.equal(unknown.prompt, null);

for (const mode of ["english", "hindi", "hinglish"]) {
  const hints = getOpenAiTranscriptionHints(mode);
  assert.notEqual(hints.language, "english");
  assert.notEqual(hints.language, "hindi");
  assert.notEqual(hints.language, "hinglish");
}

console.log("ASR language hint tests passed.");
