export const openAiTranscriptionModels = [
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
  "whisper-1"
] as const;

export type OpenAiTranscriptionModel =
  (typeof openAiTranscriptionModels)[number];

export const defaultOpenAiTranscriptionModel: OpenAiTranscriptionModel =
  "gpt-4o-transcribe";

export function isOpenAiTranscriptionModel(
  value: string | null | undefined
): value is OpenAiTranscriptionModel {
  return (
    typeof value === "string" &&
    openAiTranscriptionModels.includes(value as OpenAiTranscriptionModel)
  );
}

export function getOpenAiTranscriptionModel(
  value: string | null | undefined
): OpenAiTranscriptionModel {
  return isOpenAiTranscriptionModel(value)
    ? value
    : defaultOpenAiTranscriptionModel;
}
