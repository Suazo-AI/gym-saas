import { ApiError } from "@/lib/api/api-error";
import { mapSupabaseError } from "@/lib/api/map-supabase-error";

import type { FaceVerificationResultDto } from "../types/entry.dto";

type RpcClient = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

type VerifyFaceAccessInput = {
  gymId: string;
  branchId?: string | null;
  deviceId?: string | null;
  embedding: number[];
  similarityThreshold?: number;
  processingMs?: number | null;
  modelCode?: string;
  rpc?: RpcClient;
};

export async function verifyFaceAccessWithEmbedding(
  input: VerifyFaceAccessInput,
): Promise<FaceVerificationResultDto> {
  if (input.embedding.length !== 512) {
    throw new ApiError("VALIDATION_ERROR", "El embedding facial debe tener 512 dimensiones.");
  }

  const rpc = input.rpc ?? await createRpcClient();
  const { data, error } = await rpc("verify_face_access", {
    p_gym_id: input.gymId,
    p_embedding: toPgVector(input.embedding),
    p_branch_id: input.branchId ?? null,
    p_device_id: input.deviceId ?? null,
    p_similarity_threshold: input.similarityThreshold ?? 0.75,
    p_processing_ms: input.processingMs ?? null,
    p_model_code: input.modelCode ?? "insightface-buffalo-l",
  });

  if (error) {
    throw mapSupabaseError(error);
  }

  return data as FaceVerificationResultDto;
}

async function createRpcClient(): Promise<RpcClient> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  return async (fn, args) => {
    const { data, error } = await supabase.rpc(fn as never, args as never);
    return { data, error };
  };
}

function toPgVector(values: number[]) {
  return `[${values.map((value) => normalizeNumber(value)).join(",")}]`;
}

function normalizeNumber(value: number) {
  if (!Number.isFinite(value)) {
    throw new ApiError("VALIDATION_ERROR", "El embedding facial contiene valores invalidos.");
  }

  return Number(value.toFixed(8));
}
