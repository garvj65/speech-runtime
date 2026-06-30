export type AsrProviderName = "openai";

export type AsrTranscriptionRequest = {
  audioBuffer: Buffer;
  filename: string;
  mimeType: string;
  languageHint?: string | null;
  model?: string | null;
  prompt?: string | null;
};

export type AsrTranscriptionResult = {
  provider: AsrProviderName;
  model: string;
  predictedTranscript: string;
  languageDetected: string | null;
  confidence: number | null;
  durationMs: number | null;
  latencyMs: number;
  rawResponse?: unknown;
};

export type AsrProvider = {
  name: AsrProviderName;
  transcribe(request: AsrTranscriptionRequest): Promise<AsrTranscriptionResult>;
};
