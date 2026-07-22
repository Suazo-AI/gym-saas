"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CaptureStatus = "idle" | "camera" | "ready" | "error";

export function MemberFaceEnrollmentField() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [message, setMessage] = useState("Sin foto facial enrolada.");
  const [imageBase64, setImageBase64] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [consent, setConsent] = useState(false);

  const stopCamera = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (status !== "camera" || !videoRef.current || !streamRef.current) {
      return;
    }

    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      setStatus("error");
      setMessage("No pudimos iniciar la vista de la camara.");
    });
  }, [status]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  async function openCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setMessage("Este navegador no permite usar camara en esta pagina.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setStatus("camera");
      setMessage("Centra el rostro y captura la foto.");
    } catch {
      setStatus("error");
      setMessage("No pudimos abrir la camara. Revisa permisos del navegador.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setStatus("error");
      setMessage("La camara todavia no esta lista. Intenta de nuevo.");
      return;
    }

    writeImageFromCanvas(video.videoWidth, video.videoHeight, (context) => {
      context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    });
    stopCamera();
  }

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      writeImageFromCanvas(image.naturalWidth, image.naturalHeight, (context, targetWidth, targetHeight) => {
        context.drawImage(image, 0, 0, targetWidth, targetHeight);
      });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setStatus("error");
      setMessage("No pudimos leer la foto seleccionada.");
    };
    image.src = objectUrl;
  }

  function writeImageFromCanvas(
    sourceWidth: number,
    sourceHeight: number,
    draw: (context: CanvasRenderingContext2D, targetWidth: number, targetHeight: number) => void,
  ) {
    const maxWidth = 480;
    const scale = Math.min(1, maxWidth / sourceWidth);
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      setStatus("error");
      setMessage("No pudimos preparar la foto.");
      return;
    }

    draw(context, targetWidth, targetHeight);
    setImageBase64(canvas.toDataURL("image/webp", 0.72));
    setWidth(String(targetWidth));
    setHeight(String(targetHeight));
    setStatus("ready");
    setMessage("Foto lista para enrolamiento facial.");
  }

  function clearPhoto() {
    setImageBase64("");
    setWidth("");
    setHeight("");
    setStatus("idle");
    setMessage("Sin foto facial enrolada.");
  }

  return (
    <section className="grid gap-4 rounded-lg border-2 border-[#083f88] bg-[#061f46] p-5 text-white shadow-[0_16px_35px_rgba(8,63,136,0.22)] md:grid-cols-[1fr_1.2fr]">
      <input name="faceImageBase64" type="hidden" value={imageBase64} />
      <input name="faceImageWidth" type="hidden" value={width} />
      <input name="faceImageHeight" type="hidden" value={height} />
      <input name="biometricConsentGranted" type="hidden" value={consent ? "on" : ""} />

      <div className="space-y-3">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ffb36b]">Acceso facial</p>
        <h2 className="text-2xl font-black">Foto para reconocimiento</h2>
        <p className="text-sm font-semibold text-blue-100">
          Esta foto se guarda en Storage privado y el embedding se genera en el servicio seguro local.
        </p>
        <label className="flex gap-3 rounded-md border border-white/20 bg-white/10 p-3 text-sm font-bold">
          <input
            checked={consent}
            className="mt-1 h-4 w-4 accent-[#ff7a1a]"
            onChange={(event) => setConsent(event.target.checked)}
            type="checkbox"
          />
          El miembro autoriza usar su rostro para validar entradas al gimnasio.
        </label>
        <p className={`text-sm font-black ${status === "error" ? "text-orange-200" : "text-white"}`}>
          {message}
        </p>
      </div>

      <div className="grid gap-3">
        <div className="overflow-hidden rounded-md border border-white/20 bg-black/30">
          {status === "camera" ? (
            <video className="aspect-video w-full object-cover" muted playsInline ref={videoRef} />
          ) : imageBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Foto facial capturada" className="aspect-video w-full object-cover" src={imageBase64} />
          ) : (
            <div className="flex aspect-video items-center justify-center text-sm font-bold text-blue-100">
              Camara o foto
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {status === "camera" ? (
            <button
              className="rounded-md bg-[#ff7a1a] px-4 py-2 text-sm font-black text-white hover:bg-[#e86305]"
              onClick={capturePhoto}
              type="button"
            >
              Capturar
            </button>
          ) : (
            <button
              className="rounded-md bg-[#ff7a1a] px-4 py-2 text-sm font-black text-white hover:bg-[#e86305]"
              onClick={openCamera}
              type="button"
            >
              Usar camara
            </button>
          )}

          <label className="cursor-pointer rounded-md border border-white/30 px-4 py-2 text-sm font-black text-white hover:bg-white/10">
            Subir foto
            <input
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => void handleFile(event.target.files?.[0])}
              type="file"
            />
          </label>

          {imageBase64 ? (
            <button
              className="rounded-md border border-white/30 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
              onClick={clearPhoto}
              type="button"
            >
              Quitar
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
