"use client";

import { useRef, useState } from "react";

type SavedClip = {
  url: string;
  shotShape: string;
  createdAt: string;
};

const shotShapes = [
  "Big Hook",
  "Hook",
  "Pull",
  "Straight",
  "Push",
  "Fade",
  "Slice",
  "Big Slice",
];

export default function Home() {
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const detectionLoopRef = useRef<number | null>(null);

  const autoDetectRef = useRef(false);
  const isRecordingRef = useRef(false);
  const lastCaptureTimeRef = useRef(0);

  const [cameraOn, setCameraOn] = useState(false);
  const [autoDetectOn, setAutoDetectOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [selectedShotShape, setSelectedShotShape] = useState("Straight");
  const [savedClips, setSavedClips] = useState<SavedClip[]>([]);
  const [motionScore, setMotionScore] = useState(0);
  const [status, setStatus] = useState("Camera off");
  const [error, setError] = useState<string | null>(null);

  const MOTION_THRESHOLD = 12;
  const CLIP_LENGTH_MS = 5000;
  const COOLDOWN_MS = 5000;

  async function startCamera() {
    try {
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play();
      }

      setCameraOn(true);
      setStatus("Back camera ready");
    } catch (err) {
      console.error(err);
      setError("Camera failed. Check camera permission.");
    }
  }

  function startRecording() {
    if (!mediaStreamRef.current || isRecordingRef.current) return;

    if (clipUrl && !savedClips.some((clip) => clip.url === clipUrl)) {
      URL.revokeObjectURL(clipUrl);
      setClipUrl(null);
    }

    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";

    const recorder = mimeType
      ? new MediaRecorder(mediaStreamRef.current, { mimeType })
      : new MediaRecorder(mediaStreamRef.current);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "video/webm",
      });

      const url = URL.createObjectURL(blob);
      setClipUrl(url);

      isRecordingRef.current = false;
      setRecording(false);
      setStatus("Replay ready");
    };

    recorder.start();

    isRecordingRef.current = true;
    setRecording(true);
    setStatus("Capturing swing...");

    setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, CLIP_LENGTH_MS);
  }

  function detectMotion() {
    const video = liveVideoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !autoDetectRef.current) return;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    canvas.width = 160;
    canvas.height = 90;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const currentFrame = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    ).data;

    const previousFrame = previousFrameRef.current;

    if (previousFrame) {
      let totalDifference = 0;

      for (let i = 0; i < currentFrame.length; i += 4) {
        const rDiff = Math.abs(currentFrame[i] - previousFrame[i]);
        const gDiff = Math.abs(currentFrame[i + 1] - previousFrame[i + 1]);
        const bDiff = Math.abs(currentFrame[i + 2] - previousFrame[i + 2]);

        totalDifference += (rDiff + gDiff + bDiff) / 3;
      }

      const averageDifference = totalDifference / (currentFrame.length / 4);
      setMotionScore(Math.round(averageDifference));

      const now = Date.now();

      if (
        averageDifference > MOTION_THRESHOLD &&
        !isRecordingRef.current &&
        now - lastCaptureTimeRef.current > COOLDOWN_MS
      ) {
        lastCaptureTimeRef.current = now;
        startRecording();
      }
    }

    previousFrameRef.current = new Uint8ClampedArray(currentFrame);
    detectionLoopRef.current = requestAnimationFrame(detectMotion);
  }

  function startAutoDetect() {
    if (!cameraOn) {
      setError("Start the camera first.");
      return;
    }

    setError(null);
    setAutoDetectOn(true);
    autoDetectRef.current = true;
    previousFrameRef.current = null;
    setStatus("Auto detect watching...");

    detectionLoopRef.current = requestAnimationFrame(detectMotion);
  }

  function stopAutoDetect() {
    setAutoDetectOn(false);
    autoDetectRef.current = false;
    setStatus("Auto detect stopped");

    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }
  }

  function saveClip() {
    if (!clipUrl) return;

    const alreadySaved = savedClips.some((clip) => clip.url === clipUrl);

    if (!alreadySaved) {
      setSavedClips((prev) => [
        ...prev,
        {
          url: clipUrl,
          shotShape: selectedShotShape,
          createdAt: new Date().toLocaleString(),
        },
      ]);

      setStatus(`Clip saved as ${selectedShotShape}`);
    }
  }

  function deleteClip() {
    if (!clipUrl) return;

    URL.revokeObjectURL(clipUrl);
    setClipUrl(null);
    setStatus("Clip deleted");
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
        <h1 className="text-center text-2xl font-bold">Auto Swing Replay</h1>

        {error && (
          <div className="rounded-xl bg-red-500/20 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-zinc-900 p-3 text-sm">
          <p>Status: {status}</p>
          <p>Motion Score: {motionScore}</p>
          <p>Threshold: {MOTION_THRESHOLD}</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/20 bg-zinc-900">
          <video
            ref={liveVideoRef}
            autoPlay
            playsInline
            muted
            className="h-[500px] w-full object-cover"
          />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="grid grid-cols-2 gap-3">
          {!cameraOn && (
            <button
              onClick={startCamera}
              className="col-span-2 rounded-xl bg-green-500 p-3 font-bold text-black"
            >
              Start Back Camera
            </button>
          )}

          {cameraOn && !autoDetectOn && (
            <button
              onClick={startAutoDetect}
              className="rounded-xl bg-purple-500 p-3 font-bold"
            >
              Start Auto Detect
            </button>
          )}

          {autoDetectOn && (
            <button
              onClick={stopAutoDetect}
              className="rounded-xl bg-zinc-700 p-3 font-bold"
            >
              Stop Auto Detect
            </button>
          )}

          {cameraOn && !recording && (
            <button
              onClick={startRecording}
              className="rounded-xl bg-red-500 p-3 font-bold"
            >
              Manual Capture
            </button>
          )}

          {recording && (
            <button
              disabled
              className="rounded-xl bg-yellow-400 p-3 font-bold text-black"
            >
              Capturing...
            </button>
          )}

          {clipUrl && (
            <>
              <button
                onClick={saveClip}
                className="rounded-xl bg-blue-500 p-3 font-bold"
              >
                Save Clip
              </button>

              <button
                onClick={deleteClip}
                className="rounded-xl bg-zinc-700 p-3 font-bold"
              >
                Delete Clip
              </button>
            </>
          )}
        </div>

        {clipUrl && (
          <section className="rounded-2xl border border-white/20 p-3">
            <h2 className="mb-2 font-bold">Replay</h2>

            <video
              src={clipUrl}
              controls
              playsInline
              className="w-full rounded-xl"
            />

            <div className="mt-3 rounded-xl bg-zinc-900 p-3">
              <p className="mb-2 text-sm font-bold">Tag this swing:</p>

              <div className="grid grid-cols-2 gap-2">
                {shotShapes.map((shape) => (
                  <button
                    key={shape}
                    onClick={() => setSelectedShotShape(shape)}
                    className={`rounded-lg p-2 text-sm font-bold ${
                      selectedShotShape === shape
                        ? "bg-blue-500 text-white"
                        : "bg-zinc-700 text-zinc-200"
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-white/20 p-3">
          <h2 className="mb-2 font-bold">Saved Swing Library</h2>

          {savedClips.length === 0 && (
            <p className="text-sm text-zinc-400">No saved clips yet.</p>
          )}

          <div className="flex flex-col gap-3">
            {savedClips.map((clip, index) => (
              <div key={clip.url} className="rounded-xl bg-zinc-900 p-3">
                <p className="mb-1 font-bold">
                  Swing {index + 1}: {clip.shotShape}
                </p>

                <p className="mb-2 text-xs text-zinc-400">{clip.createdAt}</p>

                <video
                  src={clip.url}
                  controls
                  playsInline
                  className="w-full rounded-xl"
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}