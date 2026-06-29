import { useEffect, useMemo, useRef, useState } from "react";
import groundTruthData from "../research/speech-runtime-lab/ground_truths.v0.json";

type RecordingStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "stopped"
  | "error";

type GroundTruthItem = {
  id: string;
  languageMode: "english" | "hindi" | "hinglish";
  scriptType: "latin" | "devanagari" | "mixed";
  expectedTranscript: string;
  testPurpose: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  notes: string;
};

type GroundTruthSet = {
  items: GroundTruthItem[];
};

type RecordingMetadata = {
  mimeType: string | null;
  sizeBytes: number | null;
  durationMs: number | null;
};

type TranscriptionStatus = "idle" | "transcribing" | "complete" | "error";

type AsrTranscriptionResult = {
  provider: string;
  model: string;
  predictedTranscript: string;
  languageDetected: string | null;
  confidence: number | null;
  durationMs: number | null;
  latencyMs: number;
};

type TranscriptionResponse = {
  selectedGroundTruthId: string | null;
  asr: AsrTranscriptionResult;
};

const groundTruths = (groundTruthData as GroundTruthSet).items;
const emptyMetadata: RecordingMetadata = {
  mimeType: null,
  sizeBytes: null,
  durationMs: null
};

function formatValue(value: string | number | null): string {
  return value === null ? "Not recorded" : String(value);
}

function formatOptionalValue(value: string | number | null): string {
  return value === null ? "not provided" : String(value);
}

function getRecordingFilename(mimeType: string | null): string {
  if (mimeType?.includes("wav")) {
    return "recording.wav";
  }

  if (mimeType?.includes("mp4")) {
    return "recording.mp4";
  }

  if (mimeType?.includes("ogg")) {
    return "recording.ogg";
  }

  return "recording.webm";
}

function isTranscriptionResponse(
  responseBody: TranscriptionResponse | { error?: string }
): responseBody is TranscriptionResponse {
  return "asr" in responseBody;
}

function App() {
  const [selectedId, setSelectedId] = useState(groundTruths[0]?.id ?? "");
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<RecordingMetadata>(emptyMetadata);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] =
    useState<TranscriptionStatus>("idle");
  const [transcriptionResult, setTranscriptionResult] =
    useState<TranscriptionResponse | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const discardOnStopRef = useRef(false);

  const selectedGroundTruth = useMemo(
    () => groundTruths.find((item) => item.id === selectedId) ?? groundTruths[0],
    [selectedId]
  );

  useEffect(() => {
    return () => {
      cleanupRecorder();
      revokeAudioUrl();
    };
  }, []);

  function revokeAudioUrl() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  function cleanupRecorder() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }

  function clearRecording() {
    if (status === "recording") {
      discardOnStopRef.current = true;
      mediaRecorderRef.current?.stop();
    }

    cleanupRecorder();
    revokeAudioUrl();
    chunksRef.current = [];
    startedAtRef.current = null;
    if (status !== "recording") {
      discardOnStopRef.current = false;
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setMetadata(emptyMetadata);
    setErrorMessage(null);
    setTranscriptionStatus("idle");
    setTranscriptionResult(null);
    setTranscriptionError(null);
    setStatus("idle");
  }

  async function startRecording() {
    if (!("MediaRecorder" in window)) {
      setStatus("error");
      setErrorMessage("MediaRecorder is not available in this browser.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorMessage("Microphone recording is not available in this browser.");
      return;
    }

    try {
      setStatus("requesting_permission");
      setErrorMessage(null);
      setTranscriptionStatus("idle");
      setTranscriptionResult(null);
      setTranscriptionError(null);
      revokeAudioUrl();
      setAudioUrl(null);
      setAudioBlob(null);
      setMetadata(emptyMetadata);
      chunksRef.current = [];
      discardOnStopRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      startedAtRef.current = performance.now();

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        if (discardOnStopRef.current) {
          discardOnStopRef.current = false;
          chunksRef.current = [];
          startedAtRef.current = null;
          cleanupRecorder();
          return;
        }

        const durationMs =
          startedAtRef.current === null
            ? null
            : Math.round(performance.now() - startedAtRef.current);
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const nextAudioUrl = URL.createObjectURL(blob);

        audioUrlRef.current = nextAudioUrl;
        setAudioBlob(blob);
        setAudioUrl(nextAudioUrl);
        setMetadata({
          mimeType,
          sizeBytes: blob.size,
          durationMs
        });
        setStatus("stopped");
        cleanupRecorder();
      });

      recorder.start();
      setStatus("recording");
    } catch (error) {
      cleanupRecorder();
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? `Microphone recording could not start: ${error.message}`
          : "Microphone recording could not start."
      );
    }
  }

  async function transcribeRecording() {
    if (!audioBlob) {
      setTranscriptionStatus("error");
      setTranscriptionError("Record audio before transcribing.");
      setTranscriptionResult(null);
      return;
    }

    try {
      setTranscriptionStatus("transcribing");
      setTranscriptionError(null);
      setTranscriptionResult(null);

      const formData = new FormData();
      formData.append(
        "audio",
        audioBlob,
        getRecordingFilename(metadata.mimeType)
      );

      if (selectedGroundTruth?.id) {
        formData.append("selectedGroundTruthId", selectedGroundTruth.id);
      }

      if (selectedGroundTruth?.languageMode) {
        formData.append("languageHint", selectedGroundTruth.languageMode);
      }

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      });
      const responseBody = (await response.json()) as
        | TranscriptionResponse
        | { error?: string };

      if (!response.ok || !isTranscriptionResponse(responseBody)) {
        throw new Error(
          "error" in responseBody && responseBody.error
            ? responseBody.error
            : "Transcription failed."
        );
      }

      setTranscriptionResult(responseBody);
      setTranscriptionStatus("complete");
    } catch (error) {
      setTranscriptionStatus("error");
      setTranscriptionResult(null);
      setTranscriptionError(
        error instanceof Error ? error.message : "Transcription failed."
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Speech Runtime Lab</p>
        <h1>Speech Runtime Lab v0</h1>
        <p className="subtitle">
          Browser recording skeleton for English, Hindi, and Hinglish
          listening-quality tests.
        </p>
      </section>

      <section className="grid">
        <div className="panel">
          <label className="field-label" htmlFor="ground-truth">
            Ground truth script
          </label>
          <select
            id="ground-truth"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {groundTruths.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} - {item.languageMode} - {item.testPurpose}
              </option>
            ))}
          </select>

          {selectedGroundTruth ? (
            <div className="detail-stack">
              <div className="metadata-grid">
                <div>
                  <span>ID</span>
                  <strong>{selectedGroundTruth.id}</strong>
                </div>
                <div>
                  <span>Language mode</span>
                  <strong>{selectedGroundTruth.languageMode}</strong>
                </div>
                <div>
                  <span>Script type</span>
                  <strong>{selectedGroundTruth.scriptType}</strong>
                </div>
                <div>
                  <span>Difficulty</span>
                  <strong>{selectedGroundTruth.difficulty}</strong>
                </div>
              </div>

              <div>
                <span className="field-label">Test purpose</span>
                <p>{selectedGroundTruth.testPurpose}</p>
              </div>

              <div>
                <span className="field-label">Tags</span>
                <div className="tag-row">
                  {selectedGroundTruth.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="field-label">Expected transcript</span>
                <p className="transcript-box">
                  {selectedGroundTruth.expectedTranscript}
                </p>
              </div>

              <div>
                <span className="field-label">Notes</span>
                <p>{selectedGroundTruth.notes}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Browser recorder</h2>
              <p>Local microphone capture only.</p>
            </div>
            <span className={`status-pill status-${status}`}>{status}</span>
          </div>

          <div className="button-row">
            <button
              type="button"
              onClick={startRecording}
              disabled={
                status === "requesting_permission" || status === "recording"
              }
            >
              Start recording
            </button>
            <button
              type="button"
              onClick={stopRecording}
              disabled={status !== "recording"}
            >
              Stop recording
            </button>
            <button
              type="button"
              className="secondary"
              onClick={clearRecording}
              disabled={status === "requesting_permission"}
            >
              Clear recording
            </button>
            <button
              type="button"
              onClick={transcribeRecording}
              disabled={
                status === "recording" ||
                !audioBlob ||
                transcriptionStatus === "transcribing"
              }
            >
              Transcribe recording
            </button>
          </div>

          {errorMessage ? <p className="error-message">{errorMessage}</p> : null}
          {transcriptionError ? (
            <p className="error-message">{transcriptionError}</p>
          ) : null}

          <div className="metadata-grid recording-grid">
            <div>
              <span>Status</span>
              <strong>{status}</strong>
            </div>
            <div>
              <span>MIME type</span>
              <strong>{formatValue(metadata.mimeType)}</strong>
            </div>
            <div>
              <span>Size bytes</span>
              <strong>{formatValue(metadata.sizeBytes)}</strong>
            </div>
            <div>
              <span>Approx duration ms</span>
              <strong>{formatValue(metadata.durationMs)}</strong>
            </div>
            <div>
              <span>Selected ground truth ID</span>
              <strong>{selectedGroundTruth?.id ?? "None"}</strong>
            </div>
            <div>
              <span>Transcription status</span>
              <strong>{transcriptionStatus}</strong>
            </div>
          </div>

          {audioUrl ? (
            <div className="playback">
              <span className="field-label">Playback</span>
              <audio controls src={audioUrl} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel result-panel">
        <div className="panel-heading">
          <div>
            <h2>ASR transcript result</h2>
            <p>
              VAD and WER/CER metrics are not run in this task. This task only
              returns the first ASR transcript.
            </p>
          </div>
          <span className={`status-pill status-${transcriptionStatus}`}>
            {transcriptionStatus}
          </span>
        </div>

        {transcriptionResult ? (
          <div className="transcription-stack">
            <div className="metadata-grid">
              <div>
                <span>Provider</span>
                <strong>{transcriptionResult.asr.provider}</strong>
              </div>
              <div>
                <span>Model</span>
                <strong>{transcriptionResult.asr.model}</strong>
              </div>
              <div>
                <span>Latency ms</span>
                <strong>{transcriptionResult.asr.latencyMs}</strong>
              </div>
              <div>
                <span>Ground truth ID</span>
                <strong>{transcriptionResult.selectedGroundTruthId ?? "None"}</strong>
              </div>
              <div>
                <span>Language detected</span>
                <strong>
                  {formatOptionalValue(transcriptionResult.asr.languageDetected)}
                </strong>
              </div>
              <div>
                <span>Confidence</span>
                <strong>
                  {formatOptionalValue(transcriptionResult.asr.confidence)}
                </strong>
              </div>
            </div>

            <div>
              <span className="field-label">Predicted transcript</span>
              <p className="transcript-box predicted-transcript">
                {transcriptionResult.asr.predictedTranscript}
              </p>
            </div>
          </div>
        ) : (
          <p className="empty-result">
            Record audio, then transcribe it through the local API server.
          </p>
        )}
      </section>
    </main>
  );
}

export default App;
