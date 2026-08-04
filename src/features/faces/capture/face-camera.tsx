"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { coverCrop } from "./capture-geometry";

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};

const CAPTURE_WIDTH = 960;
const CAPTURE_HEIGHT = 720;

export type CapturedFrame = {
  imageBase64: string;
  width: number;
  height: number;
  capturedAt: string;
};

export type FaceCameraProps = {
  frameCount: number;
  onCapture: (frames: CapturedFrame[]) => Promise<void> | void;
  onCancel?: () => void;
};

type CameraStatus = "idle" | "opening" | "ready" | "capturing" | "error";

export function hasMinimumCameraResolution(width: number, height: number) {
  return Math.max(width, height) >= 1280 && Math.min(width, height) >= 720;
}

export function drawCoverFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  const { sx, sy, sw, sh } = coverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight);
  context.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
}

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function attachMediaStream(video: HTMLVideoElement, stream: MediaStream) {
  video.srcObject = stream;
  await video.play();
}

export function FaceCamera({ frameCount, onCapture, onCancel }: FaceCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [message, setMessage] = useState("Abre la cámara para comenzar.");

  const stopCamera = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setMessage("Este navegador no permite usar la cámara en esta página.");
      return;
    }

    setStatus("opening");
    setMessage("Abriendo cámara...");
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Video unavailable");
      await attachMediaStream(videoRef.current, stream);
    } catch {
      setStatus("error");
      setMessage("No pudimos abrir la cámara. Revisa los permisos del navegador.");
    }
  }

  function handleVideoReady() {
    const video = videoRef.current;
    if (!video) return;
    if (!hasMinimumCameraResolution(video.videoWidth, video.videoHeight)) {
      setStatus("error");
      setMessage("La cámara debe ofrecer al menos 720p.");
      stopCamera();
      return;
    }
    setStatus("ready");
    setMessage("Centra el rostro dentro de la guía y mantén buena iluminación.");
  }

  async function captureFrames() {
    const video = videoRef.current;
    if (!video || status !== "ready") return;

    setStatus("capturing");
    setMessage(`Capturando ${frameCount} imágenes...`);
    try {
      const frames: CapturedFrame[] = [];
      for (let index = 0; index < frameCount; index += 1) {
        if (index > 0) await nextVideoFrame(video);
        const canvas = document.createElement("canvas");
        canvas.width = CAPTURE_WIDTH;
        canvas.height = CAPTURE_HEIGHT;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        drawCoverFrame(
          context,
          video,
          video.videoWidth,
          video.videoHeight,
          CAPTURE_WIDTH,
          CAPTURE_HEIGHT,
        );
        frames.push({
          imageBase64: canvas.toDataURL("image/jpeg", 0.95),
          width: CAPTURE_WIDTH,
          height: CAPTURE_HEIGHT,
          capturedAt: new Date().toISOString(),
        });
      }
      await onCapture(frames);
      setStatus("ready");
      setMessage("Captura completada.");
    } catch {
      setStatus("error");
      setMessage("No pudimos preparar las imágenes. Intenta nuevamente.");
    }
  }

  function cancel() {
    stopCamera();
    setStatus("idle");
    setMessage("Abre la cámara para comenzar.");
    onCancel?.();
  }

  return (
    <div className="grid gap-3">
      <div className="relative overflow-hidden rounded-lg bg-slate-950">
        <video
          className="aspect-[4/3] w-full object-cover"
          muted
          onLoadedMetadata={handleVideoReady}
          playsInline
          ref={videoRef}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[12%_27%] rounded-[50%] border-4 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]"
        />
      </div>
      <p aria-live="polite" className="text-sm font-semibold text-slate-600">
        {message}
      </p>
      <div className="flex flex-wrap gap-2">
        {status === "idle" || status === "error" ? (
          <button className="min-h-11 rounded-md bg-brand-orange px-4 py-2 text-sm font-black text-ink" onClick={openCamera} type="button">
            Abrir cámara
          </button>
        ) : (
          <button
            className="min-h-11 rounded-md bg-brand-orange px-4 py-2 text-sm font-black text-ink disabled:opacity-60"
            disabled={status !== "ready"}
            onClick={captureFrames}
            type="button"
          >
            Capturar
          </button>
        )}
        <button className="min-h-11 rounded-md border border-slate-300 px-4 py-2 text-sm font-black" onClick={cancel} type="button">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function nextVideoFrame(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    if ("requestVideoFrameCallback" in video) {
      video.requestVideoFrameCallback(() => resolve());
      return;
    }
    requestAnimationFrame(() => resolve());
  });
}
