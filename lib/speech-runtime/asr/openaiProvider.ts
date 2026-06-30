import OpenAI from "openai";
import { toFile } from "openai/uploads";
import type {
  AsrProvider,
  AsrTranscriptionRequest,
  AsrTranscriptionResult
} from "./types";
import { getOpenAiTranscriptionModel } from "./openAiModels";

const missingApiKeyMessage =
  "OPENAI_API_KEY is required for OpenAI transcription.";
const missingTextMessage =
  "OpenAI transcription response did not include text.";

function getTextFromResponse(response: unknown): string | null {
  if (
    typeof response === "object" &&
    response !== null &&
    "text" in response &&
    typeof response.text === "string" &&
    response.text.trim().length > 0
  ) {
    return response.text;
  }

  return null;
}

export function createOpenAiAsrProvider(): AsrProvider {
  return {
    name: "openai",
    async transcribe(
      request: AsrTranscriptionRequest
    ): Promise<AsrTranscriptionResult> {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error(missingApiKeyMessage);
      }

      const model = getOpenAiTranscriptionModel(
        request.model || process.env.OPENAI_TRANSCRIBE_MODEL || null
      );
      const openai = new OpenAI({ apiKey });
      const file = await toFile(request.audioBuffer, request.filename, {
        type: request.mimeType
      });
      const startedAt = Date.now();

      const response = await openai.audio.transcriptions.create({
        file,
        model,
        response_format: "json",
        ...(request.languageHint ? { language: request.languageHint } : {}),
        ...(request.prompt ? { prompt: request.prompt } : {})
      });

      const latencyMs = Date.now() - startedAt;
      const predictedTranscript = getTextFromResponse(response);

      if (!predictedTranscript) {
        throw new Error(missingTextMessage);
      }

      return {
        provider: "openai",
        model,
        predictedTranscript,
        languageDetected: null,
        confidence: null,
        durationMs: null,
        latencyMs,
        rawResponse: response
      };
    }
  };
}
