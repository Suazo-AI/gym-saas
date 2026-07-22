"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VerificationResult = {
  decision: "allowed" | "denied" | "manual_review" | "no_match";
  decisionReason: string;
  accessAllowed: boolean;
  similarity: number | null;
};

export function FaceAccessModal() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "camera" | "verifying" | "error" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("camera");
    setMessage(null);
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setStatus("error");
      setMessage("No pudimos abrir la camara. Revisa permisos del navegador.");
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  function openModal() {
    setOpen(true);
    void startCamera();
  }

  function closeModal() {
    setOpen(false);
    stopCamera();
  }

  async function captureAndVerify() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    setStatus("verifying");
    setMessage("Verificando rostro y suscripcion activa...");

    try {
      const response = await fetch("/api/face/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: canvas.toDataURL("image/jpeg", 0.86) }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "No pudimos verificar el rostro.");
      }

      setResult(payload as VerificationResult);
      setStatus("done");
      setMessage(null);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No pudimos verificar el rostro.");
    }
  }

  return (
    <>
      <button
        className="rounded-md bg-[#ff7a1a] px-5 py-3 text-sm font-black text-white hover:bg-[#e86305]"
        onClick={openModal}
        type="button"
      >
        Verificar con camara
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#061f46]/80 p-4">
          <section className="w-full max-w-3xl rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-2xl font-black text-[#061f46]">Reconocimiento facial</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Captura automatica y validacion de suscripcion activa.
                </p>
              </div>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-black text-slate-700"
                onClick={closeModal}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-[1.2fr_0.8fr]">
              <div className="overflow-hidden rounded-lg bg-slate-950">
                <video className="aspect-video w-full object-cover" muted playsInline ref={videoRef} />
                <canvas className="hidden" ref={canvasRef} />
              </div>

              <aside className="grid content-between gap-4">
                <ResultPanel message={message} result={result} status={status} />
                <button
                  className="min-h-12 rounded-md bg-[#083f88] px-5 py-3 text-sm font-black text-white hover:bg-[#062f66] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={status !== "camera"}
                  onClick={captureAndVerify}
                  type="button"
                >
                  Capturar y verificar
                </button>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function ResultPanel({
  message,
  result,
  status,
}: {
  message: string | null;
  result: VerificationResult | null;
  status: string;
}) {
  if (result) {
    const allowed = result.decision === "allowed";
    return (
      <div className={`rounded-lg border p-5 ${allowed ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Resultado
        </span>
        <strong className={`mt-3 block text-3xl font-black ${allowed ? "text-emerald-700" : "text-orange-800"}`}>
          {decisionLabel(result.decision)}
        </strong>
        <p className="mt-3 text-sm font-semibold text-slate-700">{result.decisionReason}</p>
        <p className="mt-2 text-sm text-slate-500">
          Similitud: {result.similarity === null ? "sin coincidencia" : `${Math.round(result.similarity * 100)}%`}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        Estado
      </span>
      <strong className="mt-3 block text-2xl font-black text-[#083f88]">
        {status === "verifying" ? "Verificando" : status === "error" ? "Error" : "Camara lista"}
      </strong>
      <p className="mt-3 text-sm font-semibold text-slate-600">
        {message ?? "Centra el rostro del miembro y captura una imagen."}
      </p>
    </div>
  );
}

function decisionLabel(decision: VerificationResult["decision"]) {
  if (decision === "allowed") return "Acceso permitido";
  if (decision === "denied") return "Acceso denegado";
  if (decision === "manual_review") return "Revision manual";
  return "Sin coincidencia";
}
