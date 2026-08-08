import "server-only";

import { ApiError } from "@/lib/api/api-error";
import { getFaceServiceEnv } from "@/lib/env.server";

type FaceEmbeddingResponse = {
  embedding: number[];
  faceCount: number;
  qualityScore: number | null;
  modelCode: string;
  processingMs: number;
};

export async function generateFaceEmbedding(imageBase64: string): Promise<FaceEmbeddingResponse> {
  const faceServiceEnv = getFaceServiceEnv();

  const response = await fetch(new URL("/embed", faceServiceEnv.FACE_RECOGNITION_SERVICE_URL), {
    method: "POST",
    headers: {
      authorization: `Bearer ${faceServiceEnv.FACE_RECOGNITION_SERVICE_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ imageBase64 }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await safeJson(response);
    throw new ApiError(
      response.status === 422 ? "BUSINESS_RULE_VIOLATION" : "EXTERNAL_SERVICE_ERROR",
      typeof body.detail === "string" ? body.detail : "No pudimos procesar el rostro.",
    );
  }

  const data = await response.json() as FaceEmbeddingResponse;

  if (!Array.isArray(data.embedding) || data.embedding.length !== 128) {
    throw new ApiError("EXTERNAL_SERVICE_ERROR", "El servicio facial devolvio un embedding invalido.");
  }

  return data;
}

async function safeJson(response: Response): Promise<{ detail?: unknown }> {
  try {
    return await response.json() as { detail?: unknown };
  } catch {
    return {};
  }
}
