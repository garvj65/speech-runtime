import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { createOpenAiAsrProvider } from "../lib/speech-runtime/asr";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.API_PORT || 8787);
const missingApiKeyMessage =
  "OPENAI_API_KEY is required for OpenAI transcription.";

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Transcription failed.";
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
    const asr = await provider.transcribe({
      audioBuffer: audioFile.buffer,
      filename: audioFile.originalname || "recording.webm",
      mimeType: audioFile.mimetype || "audio/webm",
      languageHint:
        typeof request.body.languageHint === "string"
          ? request.body.languageHint
          : null
    });

    response.json({
      selectedGroundTruthId:
        typeof request.body.selectedGroundTruthId === "string" &&
        request.body.selectedGroundTruthId.length > 0
          ? request.body.selectedGroundTruthId
          : null,
      asr
    });
  } catch (error) {
    response.status(500).json({ error: getSafeErrorMessage(error) });
  }
});

app.listen(port, "127.0.0.1", () => {
  console.log(`speech-runtime-api listening on http://127.0.0.1:${port}`);
});
