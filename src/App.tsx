import { useEffect, useMemo, useRef, useState } from "react";
import groundTruthData from "../research/speech-runtime-lab/ground_truths.v0.json";

type VadWebModule = typeof import("@ricky0123/vad-web");
type MicVadInstance = Awaited<ReturnType<VadWebModule["MicVAD"]["new"]>>;

type RecordingStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "stopped"
  | "error";

type VadMode = "none" | "silero";

type VadStatus =
  | "idle"
  | "disabled"
  | "loading"
  | "ready"
  | "running"
  | "stopped"
  | "error";

type VadSpeechSegment = {
  startMs: number;
  endMs: number;
  durationMs: number;
};

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

type TokenDiffOperation =
  | { type: "match"; expected: string; predicted: string }
  | { type: "substitution"; expected: string; predicted: string }
  | { type: "insertion"; expected: null; predicted: string }
  | { type: "deletion"; expected: string; predicted: null };

type TranscriptQualityMetrics = {
  normalizedExpectedTranscript: string | null;
  normalizedPredictedTranscript: string;
  wer: number | null;
  cer: number | null;
  wordAccuracy: number | null;
  substitutions: number | null;
  insertions: number | null;
  deletions: number | null;
  tokenDiff: TokenDiffOperation[];
  reason?: string;
};

type TranscriptionResponse = {
  selectedGroundTruthId: string | null;
  expectedTranscript: string | null;
  asr: AsrTranscriptionResult;
  transcriptQuality: TranscriptQualityMetrics;
};

const openAiTranscriptionModels = [
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
  "whisper-1"
] as const;

type VadSummary = {
  speechSegmentCount: number;
  detectedSpeechDurationMs: number;
  detectedSilenceDurationMs: number | null;
  speechRatio: number | null;
  warnings: string[];
};

const vadAssetBasePath = "/node_modules/@ricky0123/vad-web/dist/";
const onnxWasmBasePath = "/node_modules/onnxruntime-web/dist/";
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

function formatMetricValue(value: number | null): string {
  return value === null ? "not available" : value.toFixed(4);
}

function formatMetricPercent(value: number | null): string {
  return value === null ? "not available" : `${(value * 100).toFixed(2)}%`;
}

function formatCountMetric(value: number | null): string {
  return value === null ? "not available" : String(value);
}

function summarizeVadSegments(params: {
  audioDurationMs: number | null;
  speechSegments: VadSpeechSegment[];
}): VadSummary {
  const detectedSpeechDurationMs = params.speechSegments.reduce(
    (total, segment) => total + segment.durationMs,
    0
  );
  const audioDurationMs = params.audioDurationMs;
  const hasValidAudioDuration =
    typeof audioDurationMs === "number" &&
    Number.isFinite(audioDurationMs) &&
    audioDurationMs > 0;
  const warnings: string[] = [];

  if (audioDurationMs == null) {
    warnings.push(
      "Audio duration is unavailable; silence duration and speech ratio were not calculated."
    );
  } else if (!Number.isFinite(audioDurationMs) || audioDurationMs <= 0) {
    warnings.push(
      "Audio duration is invalid; silence duration and speech ratio were not calculated."
    );
  }

  if (params.speechSegments.length === 0) {
    warnings.push("No speech segments detected.");
  }

  if (hasValidAudioDuration && detectedSpeechDurationMs > audioDurationMs) {
    warnings.push("Detected speech duration exceeds audio duration.");
  }

  return {
    speechSegmentCount: params.speechSegments.length,
    detectedSpeechDurationMs,
    detectedSilenceDurationMs: hasValidAudioDuration
      ? Math.max(0, audioDurationMs - detectedSpeechDurationMs)
      : null,
    speechRatio: hasValidAudioDuration
      ? detectedSpeechDurationMs / audioDurationMs
      : null,
    warnings
  };
}

function formatTokenDiffOperation(operation: TokenDiffOperation): string {
  if (operation.type === "substitution") {
    return `${operation.expected} -> ${operation.predicted}`;
  }

  if (operation.type === "insertion") {
    return `* ${operation.predicted}`;
  }

  if (operation.type === "deletion") {
    return `* ${operation.expected}`;
  }

  return operation.expected;
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
  const [vadMode, setVadMode] = useState<VadMode>("none");
  const [vadStatus, setVadStatus] = useState<VadStatus>("disabled");
  const [vadError, setVadError] = useState<string | null>(null);
  const [vadSegments, setVadSegments] = useState<VadSpeechSegment[]>([]);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState<number | null>(
    null
  );
  const [selectedAsrModel, setSelectedAsrModel] =
    useState<(typeof openAiTranscriptionModels)[number]>(
      "gpt-4o-transcribe"
    );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<MicVadInstance | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const openVadSegmentStartedAtRef = useRef<number | null>(null);
  const vadRunIdRef = useRef(0);
  const discardOnStopRef = useRef(false);

  const selectedGroundTruth = useMemo(
    () => groundTruths.find((item) => item.id === selectedId) ?? groundTruths[0],
    [selectedId]
  );
  const vadSummary = useMemo(
    () =>
      summarizeVadSegments({
        audioDurationMs: metadata.durationMs ?? recordingElapsedMs,
        speechSegments: vadSegments
      }),
    [metadata.durationMs, recordingElapsedMs, vadSegments]
  );

  useEffect(() => {
    return () => {
      vadRunIdRef.current += 1;
      void cleanupVadInstance();
      cleanupRecorder();
      revokeAudioUrl();
    };
  }, []);

  useEffect(() => {
    if (status !== "recording") {
      return;
    }

    const timer = window.setInterval(() => {
      setRecordingElapsedMs(getRecordingElapsedMs());
    }, 250);

    return () => window.clearInterval(timer);
  }, [status]);

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

  async function cleanupVadInstance() {
    const vad = vadRef.current;
    vadRef.current = null;

    if (!vad) {
      return;
    }

    try {
      if (vad.listening) {
        await vad.pause();
      }
      await vad.destroy();
    } catch {
      // Cleanup is best-effort because MicVAD may fail before full initialization.
    }
  }

  function getRecordingElapsedMs() {
    return startedAtRef.current === null
      ? null
      : Math.max(0, Math.round(performance.now() - startedAtRef.current));
  }

  function closeOpenVadSegment(endMs: number | null = getRecordingElapsedMs()) {
    const startMs = openVadSegmentStartedAtRef.current;

    if (startMs === null || endMs === null) {
      openVadSegmentStartedAtRef.current = null;
      return;
    }

    const normalizedEndMs = Math.max(startMs, endMs);
    openVadSegmentStartedAtRef.current = null;
    setVadSegments((segments) => [
      ...segments,
      {
        startMs,
        endMs: normalizedEndMs,
        durationMs: normalizedEndMs - startMs
      }
    ]);
  }

  async function startSileroVad(runId: number) {
    try {
      await cleanupVadInstance();
      setVadStatus("loading");
      setVadError(null);

      const { MicVAD } = await import("@ricky0123/vad-web");
      const vad = await MicVAD.new({
        baseAssetPath: vadAssetBasePath,
        onnxWASMBasePath: onnxWasmBasePath,
        model: "legacy",
        startOnLoad: false,
        submitUserSpeechOnPause: true,
        onSpeechStart: () => {
          if (vadRunIdRef.current !== runId) {
            return;
          }

          openVadSegmentStartedAtRef.current = getRecordingElapsedMs();
          setVadStatus("running");
        },
        onSpeechEnd: () => {
          if (vadRunIdRef.current !== runId) {
            return;
          }

          closeOpenVadSegment();
          setVadStatus("running");
        }
      });

      if (vadRunIdRef.current !== runId) {
        await vad.destroy();
        return;
      }

      vadRef.current = vad;
      setVadStatus("ready");
      await vad.start();

      if (vadRunIdRef.current === runId) {
        setVadStatus("running");
      }
    } catch (error) {
      if (vadRunIdRef.current !== runId) {
        return;
      }

      await cleanupVadInstance();
      setVadStatus("error");
      setVadError(
        error instanceof Error
          ? `Silero VAD could not start: ${error.message}`
          : "Silero VAD could not start."
      );
    }
  }

  async function stopSileroVad(nextStatus: VadStatus = "stopped") {
    const endMs = getRecordingElapsedMs();
    closeOpenVadSegment(endMs);
    await cleanupVadInstance();
    setVadStatus(nextStatus);
  }

  function resetVadState(nextMode: VadMode = vadMode) {
    vadRunIdRef.current += 1;
    openVadSegmentStartedAtRef.current = null;
    setVadSegments([]);
    setVadError(null);
    setRecordingElapsedMs(null);
    setVadStatus(nextMode === "none" ? "disabled" : "idle");
  }

  function clearRecording() {
    if (status === "recording") {
      discardOnStopRef.current = true;
      mediaRecorderRef.current?.stop();
    }

    void cleanupVadInstance();
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
    resetVadState();
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
      resetVadState(vadMode);
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
          setRecordingElapsedMs(null);
          cleanupRecorder();
          return;
        }

        void stopSileroVad(vadMode === "none" ? "disabled" : "stopped");
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
        setRecordingElapsedMs(durationMs);
        setStatus("stopped");
        cleanupRecorder();
      });

      const runId = vadRunIdRef.current;
      recorder.start();
      setStatus("recording");
      setRecordingElapsedMs(0);

      if (vadMode === "silero") {
        void startSileroVad(runId);
      } else {
        setVadStatus("disabled");
      }
    } catch (error) {
      void stopSileroVad(vadMode === "none" ? "disabled" : "error");
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

      formData.append("asrModel", selectedAsrModel);

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
      void stopSileroVad(vadMode === "none" ? "disabled" : "stopped");
      mediaRecorderRef.current.stop();
    }
  }

  function handleVadModeChange(nextMode: VadMode) {
    setVadMode(nextMode);
    resetVadState(nextMode);
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

          <div className="vad-controls">
            <label className="field-label" htmlFor="vad-mode">
              VAD mode
            </label>
            <select
              id="vad-mode"
              value={vadMode}
              onChange={(event) =>
                handleVadModeChange(event.target.value as VadMode)
              }
              disabled={status === "recording" || status === "requesting_permission"}
            >
              <option value="none">none</option>
              <option value="silero">silero</option>
            </select>
            <p>
              Silero VAD runs locally in the browser and is used only for speech
              detection summary in this sprint.
            </p>
          </div>

          <div className="vad-controls">
            <label className="field-label" htmlFor="asr-model">
              OpenAI ASR model
            </label>
            <select
              id="asr-model"
              value={selectedAsrModel}
              onChange={(event) =>
                setSelectedAsrModel(
                  event.target
                    .value as (typeof openAiTranscriptionModels)[number]
                )
              }
              disabled={transcriptionStatus === "transcribing"}
            >
              {openAiTranscriptionModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

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
            <div>
              <span>OpenAI ASR model</span>
              <strong>{selectedAsrModel}</strong>
            </div>
          </div>

          {audioUrl ? (
            <div className="playback">
              <span className="field-label">Playback</span>
              <audio controls src={audioUrl} />
            </div>
          ) : null}

          <div className="vad-panel">
            <div className="vad-panel-heading">
              <div>
                <h2>VAD summary</h2>
                <p>Browser-side speech detection for the current recording.</p>
              </div>
              <span className={`status-pill status-${vadStatus}`}>
                {vadStatus}
              </span>
            </div>

            {vadMode === "none" ? (
              <p className="vad-disabled">
                VAD is disabled. Speech summary is unavailable in none mode.
              </p>
            ) : (
              <>
                {vadError ? <p className="vad-error">{vadError}</p> : null}

                <div className="vad-summary-grid">
                  <div>
                    <span>Mode</span>
                    <strong>{vadMode}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{vadStatus}</strong>
                  </div>
                  <div>
                    <span>Speech segments</span>
                    <strong>{vadSummary.speechSegmentCount}</strong>
                  </div>
                  <div>
                    <span>Speech duration ms</span>
                    <strong>{vadSummary.detectedSpeechDurationMs}</strong>
                  </div>
                  <div>
                    <span>Silence duration ms</span>
                    <strong>
                      {formatCountMetric(vadSummary.detectedSilenceDurationMs)}
                    </strong>
                  </div>
                  <div>
                    <span>Speech ratio</span>
                    <strong>{formatMetricPercent(vadSummary.speechRatio)}</strong>
                  </div>
                </div>

                {vadSummary.warnings.length > 0 ? (
                  <ul className="vad-warning-list">
                    {vadSummary.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}

                <div>
                  <span className="field-label">Speech start/end segments</span>
                  {vadSegments.length > 0 ? (
                    <ol className="vad-segment-list">
                      {vadSegments.map((segment, index) => (
                        <li key={`${segment.startMs}-${segment.endMs}-${index}`}>
                          <span>startMs {segment.startMs}</span>
                          <span>endMs {segment.endMs}</span>
                          <span>durationMs {segment.durationMs}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="vad-disabled">No speech segments captured yet.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="panel result-panel">
        <div className="panel-heading">
          <div>
            <h2>ASR transcript result</h2>
            <p>
              ASR transcript and WER/CER metrics are calculated after
              transcription.
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
                <span>Expected transcript</span>
                <strong>
                  {transcriptionResult.expectedTranscript ?? "not available"}
                </strong>
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

            <div className="metrics-section">
              <div className="panel-heading metrics-heading">
                <div>
                  <h2>Transcript quality metrics</h2>
                  <p>Server-side comparison against the selected ground truth.</p>
                </div>
              </div>

              {transcriptionResult.transcriptQuality.reason ? (
                <p className="metrics-reason">
                  {transcriptionResult.transcriptQuality.reason}
                </p>
              ) : null}

              <div className="metadata-grid metrics-grid">
                <div>
                  <span>WER</span>
                  <strong>
                    {formatMetricValue(transcriptionResult.transcriptQuality.wer)}
                  </strong>
                  <small>
                    {formatMetricPercent(transcriptionResult.transcriptQuality.wer)}
                  </small>
                </div>
                <div>
                  <span>CER</span>
                  <strong>
                    {formatMetricValue(transcriptionResult.transcriptQuality.cer)}
                  </strong>
                  <small>
                    {formatMetricPercent(transcriptionResult.transcriptQuality.cer)}
                  </small>
                </div>
                <div>
                  <span>Word accuracy</span>
                  <strong>
                    {formatMetricValue(
                      transcriptionResult.transcriptQuality.wordAccuracy
                    )}
                  </strong>
                  <small>
                    {formatMetricPercent(
                      transcriptionResult.transcriptQuality.wordAccuracy
                    )}
                  </small>
                </div>
                <div>
                  <span>Substitutions</span>
                  <strong>
                    {formatCountMetric(
                      transcriptionResult.transcriptQuality.substitutions
                    )}
                  </strong>
                </div>
                <div>
                  <span>Insertions</span>
                  <strong>
                    {formatCountMetric(
                      transcriptionResult.transcriptQuality.insertions
                    )}
                  </strong>
                </div>
                <div>
                  <span>Deletions</span>
                  <strong>
                    {formatCountMetric(
                      transcriptionResult.transcriptQuality.deletions
                    )}
                  </strong>
                </div>
              </div>

              <div className="normalized-grid">
                <div>
                  <span className="field-label">
                    Normalized expected transcript
                  </span>
                  <p className="transcript-box normalized-transcript">
                    {transcriptionResult.transcriptQuality
                      .normalizedExpectedTranscript ?? "not available"}
                  </p>
                </div>
                <div>
                  <span className="field-label">
                    Normalized predicted transcript
                  </span>
                  <p className="transcript-box normalized-transcript">
                    {transcriptionResult.transcriptQuality
                      .normalizedPredictedTranscript || "not available"}
                  </p>
                </div>
              </div>

              <div>
                <span className="field-label">Token diff</span>
                {transcriptionResult.transcriptQuality.tokenDiff.length > 0 ? (
                  <ol className="token-diff-list">
                    {transcriptionResult.transcriptQuality.tokenDiff.map(
                      (operation, index) => (
                        <li key={`${operation.type}-${index}`}>
                          <span
                            className={`operation-label operation-${operation.type}`}
                          >
                            {operation.type}
                          </span>
                          <span>{formatTokenDiffOperation(operation)}</span>
                        </li>
                      )
                    )}
                  </ol>
                ) : (
                  <p className="empty-result">not available</p>
                )}
              </div>
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
