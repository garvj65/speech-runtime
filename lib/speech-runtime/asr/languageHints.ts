export type OpenAiTranscriptionHints = {
  language: string | null;
  prompt: string | null;
};

export function getOpenAiTranscriptionHints(
  languageMode: string | null | undefined
): OpenAiTranscriptionHints {
  const normalized = languageMode?.trim().toLowerCase();

  if (normalized === "english") {
    return {
      language: "en",
      prompt: "Transcribe the audio in English."
    };
  }

  if (normalized === "hindi") {
    return {
      language: "hi",
      prompt:
        "Transcribe the audio in Hindi. Preserve Devanagari script when the speaker is speaking Hindi."
    };
  }

  if (normalized === "hinglish") {
    return {
      language: null,
      prompt:
        "The speaker may use Hinglish: Hindi-English code-mixed speech with Indian business terms. Transcribe the speech as spoken. Use Roman script for Hinglish words and preserve English business terms such as payment, order, WhatsApp, delivery, and number."
    };
  }

  return {
    language: null,
    prompt: null
  };
}
