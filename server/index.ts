import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { createOpenAiAsrProvider } from "../lib/speech-runtime/asr";
import type { TranscriptQualityMetrics } from "../lib/speech-runtime/types";
import {
  calculateTranscriptQualityMetrics,
  normalizeTranscript,
} from "../lib/speech-runtime/metrics";
import groundTruthData from "../research/speech-runtime-lab/ground_truths.v0.json";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.API_PORT || 8787);
const missingApiKeyMessage =
  "OPENAI_API_KEY is required for OpenAI transcription.";

type GroundTruthItem = {
  id: string;
  expectedTranscript: string;
};

type GroundTruthSet = {
  items: GroundTruthItem[];
};

const groundTruths = (groundTruthData as GroundTruthSet).items;

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Transcription failed.";
}

function getSelectedGroundTruthId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function findGroundTruthById(id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return groundTruths.find((item) => item.id === id) ?? null;
}

function createUnavailableTranscriptMetrics(
  predictedTranscript: string,
  reason: string
): TranscriptQualityMetrics {
  return {
    normalizedExpectedTranscript: null,
    normalizedPredictedTranscript: normalizeTranscript(predictedTranscript),
    wer: null,
    cer: null,
    wordAccuracy: null,
    substitutions: null,
    insertions: null,
    deletions: null,
    tokenDiff: [],
    reason,
  };
}

app.use(cors({ origin: ["http://127.0.0.1:5173", "http://localhost:5173"] }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "speech-runtime-api"
  });
});

app.post("/api/transcribe", upload.single("audio"), async (request, response) => {
  const audioFile = request.file;

  if (!audioFile) {
    response.status(400).json({ error: "Missing audio file." });
    return;
  }

  if (audioFile.size === 0) {
    response.status(400).json({ error: "Uploaded audio file is empty." });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    response.status(500).json({ error: missingApiKeyMessage });
    return;
  }

  try {
    const provider = createOpenAiAsrProvider();
    const selectedGroundTruthId = getSelectedGroundTruthId(
      request.body.selectedGroundTruthId
    );
    const asr = await provider.transcribe({
      audioBuffer: audioFile.buffer,
      filename: audioFile.originalname || "recording.webm",
      mimeType: audioFile.mimetype || "audio/webm",
      languageHint:
        typeof request.body.languageHint === "string"
          ? request.body.languageHint
          : null
    });
    const selectedGroundTruth = findGroundTruthById(selectedGroundTruthId);
    const expectedTranscript = selectedGroundTruth?.expectedTranscript ?? null;
    const transcriptQuality =
      selectedGroundTruthId === null
        ? createUnavailableTranscriptMetrics(
            asr.predictedTranscript,
            "Transcript metrics require a selected ground truth."
          )
        : selectedGroundTruth === null
          ? createUnavailableTranscriptMetrics(
              asr.predictedTranscript,
              "Selected ground truth was not found."
            )
          : calculateTranscriptQualityMetrics(
              selectedGroundTruth.expectedTranscript,
              asr.predictedTranscript
            );

    response.json({
      selectedGroundTruthId,
      expectedTranscript,
      asr,
      transcriptQuality,
    });
  } catch (error) {
    response.status(500).json({ error: getSafeErrorMessage(error) });
  }
});

app.listen(port, "127.0.0.1", () => {
  console.log(`speech-runtime-api listening on http://127.0.0.1:${port}`);
});
