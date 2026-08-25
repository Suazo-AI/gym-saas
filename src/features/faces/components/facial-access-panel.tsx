"use client";

import { useEffect, useRef, useState } from "react";

import {
  type CapturedFrame,
  FaceCamera,
} from "@/features/faces/capture/face-camera";

export type FaceVerificationResult = {
  decision: "allowed" | "denied" | "manual_review" | "no_match";
  decisionReason: string;
  accessAllowed: boolean;
  similarity: number | null;
  member: {
    gymMemberId: string;
    fullName: string;
    memberCode: string;
  } | null;
};

type VerificationRequest = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "json" | "ok">>;

type WarmupRequest = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "json" | "ok">>;

type FaceServiceStatus = "warming" | "ready" | "error";

export async function requestFaceVerification(
  imageBase64: string,
  request: VerificationRequest = fetch,
): Promise<FaceVerificationResult> {
  const response = await request("/api/face/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64 }),
  });
  const payload = await response.json();

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload
      ? String(payload.error)
      : "No pudimos verificar el rostro.";
    throw new Error(message);
  }

  return payload as FaceVerificationResult;
}

export async function requestFaceWarmup(
  request: WarmupRequest = fetch,
): Promise<void> {
  const response = await request("/api/face/warm", {
    method: "GET",
    cache: "no-store",
  });
  const payload = await response.json();

  if (!response.ok || typeof payload !== "object" || !payload || !("ok" in payload) || !payload.ok) {
    throw new Error("El servicio facial no respondió.");
  }
}

export function FacialAccessPanel({ canVerify }: { canVerify: boolean }) {
  const [status, setStatus] = useState<"idle" | "verifying" | "done" | "error">("idle");
  const [result, setResult] = useState<FaceVerificationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<FaceServiceStatus>("warming");
  const mounted = useRef(false);
  const warmupStarted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    if (canVerify && !warmupStarted.current) {
      warmupStarted.current = true;

      void requestFaceWarmup()
        .then(() => {
          if (mounted.current) setServiceStatus("ready");
        })
        .catch(() => {
          if (mounted.current) setServiceStatus("error");
        });
    }

    return () => {
      mounted.current = false;
    };
  }, [canVerify]);

  if (!canVerify) {
    return (
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-ink">Modo de consulta</h2>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          Puedes abrir esta pantalla con faces.read, pero necesitas faces.verify para usar la cámara.
        </p>
      </section>
    );
  }

  async function verifyFrames(frames: CapturedFrame[]) {
    const frame = frames[0];
    if (!frame) return;

    setStatus("verifying");
    setMessage("Verificando rostro y membresía activa...");
    setResult(null);

    try {
      const nextResult = await requestFaceVerification(frame.imageBase64);
      setResult(nextResult);
      setStatus("done");
      setMessage(null);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No pudimos verificar el rostro.");
    }
  }

  return (
    <section className="mt-6 grid gap-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
      <div
        aria-live="polite"
        className={`rounded-lg border p-4 lg:col-span-2 ${serviceStatusClasses(serviceStatus)}`}
        role={serviceStatus === "error" ? "alert" : "status"}
      >
        <span className="text-xs font-black uppercase tracking-[0.14em]">
          Servicio facial
        </span>
        <strong className="mt-1 block text-base font-black">
          {serviceStatusLabel(serviceStatus)}
        </strong>
      </div>
      <FaceCamera frameCount={1} onCapture={verifyFrames} />
      <aside aria-live="polite" className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Resultado
        </span>
        {result ? (
          <>
            <strong className="mt-3 block text-3xl font-black text-ink">
              {decisionLabel(result.decision)}
            </strong>
            {result.member ? (
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {result.member.fullName} · {result.member.memberCode}
              </p>
            ) : null}
            <p className="mt-3 text-sm text-slate-600">{result.decisionReason}</p>
          </>
        ) : (
          <>
            <strong className="mt-3 block text-2xl font-black text-ink">
              {status === "verifying" ? "Verificando" : status === "error" ? "Error" : "Sin captura"}
            </strong>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              {message ?? "Abre la cámara y centra el rostro del miembro."}
            </p>
          </>
        )}
      </aside>
    </section>
  );
}

export function decisionLabel(decision: FaceVerificationResult["decision"]) {
  if (decision === "allowed") return "Acceso permitido";
  if (decision === "denied") return "Acceso denegado";
  if (decision === "manual_review") return "Revisión manual";
  return "Sin coincidencia";
}

export function serviceStatusLabel(status: FaceServiceStatus) {
  if (status === "ready") return "Servicio listo para escanear.";
  if (status === "error") return "Servicio no disponible. Recarga la página para intentar de nuevo.";
  return "Servicio despertando...";
}

function serviceStatusClasses(status: FaceServiceStatus) {
  if (status === "ready") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (status === "error") return "border-brand-red bg-red-50 text-brand-red";
  return "border-amber-300 bg-amber-50 text-amber-900";
}
