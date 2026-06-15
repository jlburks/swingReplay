"use client";

import { useRef, useState } from "react";

export default function Home() {
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const replayVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [savedClips, setSavedClips] = useState<string[]>([]);

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    mediaStreamRef.current = stream;

    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = stream;
    }

    setCameraOn(true);
  }

  function startRecording() {
    if (!mediaStreamRef.current) return;

    // Auto-delete previous unsaved clip
    if (clipUrl && !savedClips.includes(clipUrl)) {
      URL.revokeObjectURL(clipUrl);
      setClipUrl(null);
    }

    chunksRef.current = [];

    const recorder = new MediaRecorder(mediaStreamRef.current, {
      mimeType: "video/webm",
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: "video/webm",
      });

      const url = URL.createObjectURL(blob);
      setClipUrl(url);

      if (replayVideoRef.current) {
        replayVideoRef.current.src = url;
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function saveClip() {
    if (!clipUrl) return;
    setSavedClips((prev) => [...prev, clipUrl]);
  }

  function deleteClip() {
    if (!clipUrl) return;

    URL.revokeObjectURL(clipUrl);
    setClipUrl(null);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
        <h1 className="text-center text-2xl font-bold">
          Auto Swing Replay
        </h1>

        <div className="overflow-hidden rounded-2xl border border-white/20 bg-zinc-900">
          <video
            ref={liveVideoRef}
            autoPlay
            playsInline
            muted
            className="h-[500px] w-full object-cover"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!cameraOn && (
            <button
              onClick={startCamera}
              className="col-span-2 rounded-xl bg-green-500 p-3 font-bold text-black"
            >
              Start Camera
            </button>
          )}

          {cameraOn && !recording && (
            <button
              onClick={startRecording}
              className="rounded-xl bg-red-500 p-3 font-bold"
            >
              Record Swing
            </button>
          )}

          {recording && (
            <button
              onClick={stopRecording}
              className="rounded-xl bg-yellow-400 p-3 font-bold text-black"
            >
              Stop Recording
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
              ref={replayVideoRef}
              controls
              playsInline
              className="w-full rounded-xl"
            />
          </section>
        )}

        <p className="text-center text-sm text-zinc-400">
          Saved clips this session: {savedClips.length}
        </p>
      </div>
    </main>
  );
}