"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type VerificationResult = {
  decision: "allowed" | "denied" | "manual_review" | "no_match";
  decisionReason: string;
  accessAllowed: boolean;
  similarity: number | null;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type DialogKeyboardEvent = Pick<
  ReactKeyboardEvent<HTMLElement>,
  "currentTarget" | "key" | "preventDefault" | "shiftKey"
>;

export function handleDialogKeyDown(event: DialogKeyboardEvent, closeDialog: () => void) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeDialog();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");

  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const currentIndex = focusable.indexOf(
    event.currentTarget.ownerDocument.activeElement as HTMLElement,
  );
  const movingBeforeFirst = event.shiftKey && currentIndex <= 0;
  const movingAfterLast = !event.shiftKey && currentIndex === focusable.length - 1;

  if (movingBeforeFirst || movingAfterLast) {
    event.preventDefault();
    focusable[movingBeforeFirst ? focusable.length - 1 : 0]?.focus();
  }
}

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function clearVideoStream(video: HTMLVideoElement | null) {
  if (video) {
    video.srcObject = null;
  }
}

export async function acquireMediaStream(
  requestStream: () => Promise<MediaStream>,
  isCancelled: () => boolean,
) {
  const stream = await requestStream();

  if (isCancelled()) {
    stopMediaStream(stream);
    return null;
  }

  return stream;
}

export function focusFirstDialogControl(dialog: HTMLElement | null) {
  const first = dialog
    ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find(
        (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
      )
    : null;

  first?.focus();
}

export function restoreDialogTriggerFocus(trigger: HTMLElement | null) {
  trigger?.focus();
}

export function FaceAccessModal({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const [open, setOpen] = useState(initiallyOpen);
  const [status, setStatus] = useState<"idle" | "camera" | "verifying" | "error" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    clearVideoStream(videoRef.current);
  }, []);

  const startCamera = useCallback(async () => {
    const requestId = cameraRequestRef.current + 1;
    cameraRequestRef.current = requestId;
    setStatus("camera");
    setMessage(null);
    setResult(null);

    try {
      const stream = await acquireMediaStream(
        () =>
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          }),
        () => cameraRequestRef.current !== requestId,
      );

      if (!stream) {
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      if (cameraRequestRef.current !== requestId) {
        return;
      }

      setStatus("error");
      setMessage("No pudimos abrir la camara. Revisa permisos del navegador.");
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trigger = triggerRef.current;
    focusFirstDialogControl(dialogRef.current);

    return () => restoreDialogTriggerFocus(trigger);
  }, [open]);

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
        className="rounded-md bg-brand-orange px-5 py-3 text-sm font-black text-ink hover:bg-brand-red hover:text-paper"
        onClick={openModal}
        ref={triggerRef}
        type="button"
      >
        Verificar con camara
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
          <section
            aria-labelledby="face-access-title"
            aria-modal="true"
            className="w-full max-w-3xl rounded-lg border border-charcoal bg-paper shadow-2xl"
            onKeyDown={(event) => handleDialogKeyDown(event, closeModal)}
            ref={dialogRef}
            role="dialog"
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-2xl font-black text-ink" id="face-access-title">
                  Reconocimiento facial
                </h2>
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
                  className="min-h-12 rounded-md bg-ink px-5 py-3 text-sm font-black text-paper hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60"
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
      <strong className="mt-3 block text-2xl font-black text-ink">
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
