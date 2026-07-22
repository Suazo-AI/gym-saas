import { z } from "zod";

import { mapSupabaseError } from "@/lib/api/map-supabase-error";

const uuidSchema = z.string().uuid();

const enrollMemberFaceSchema = z.object({
  gymId: uuidSchema,
  gymMemberId: uuidSchema,
  objectPath: z.string().min(1),
  mimeType: z.enum(["image/webp", "image/jpeg", "image/png"]),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
  widthPixels: z.number().int().min(1).nullable().optional(),
  heightPixels: z.number().int().min(1).nullable().optional(),
  sha256Hex: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  embedding: z.array(z.number()).length(512, "El embedding facial debe tener 512 dimensiones."),
  qualityScore: z.number().min(0).max(1).nullable().optional(),
  biometricConsentGranted: z.literal(true),
  consentVersion: z.string().min(1).default("2026-07-22"),
  modelCode: z.string().min(1).default("insightface-buffalo-l-w600k-r50"),
});

export type EnrollMemberFaceInput = z.input<typeof enrollMemberFaceSchema> & {
  rpc?: SupabaseRpc;
};

export type EnrollMemberFaceResultDto = {
  mediaAssetId: string;
  personPhotoId: string;
  faceEmbeddingId: string;
  consentId: string;
};

type SupabaseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

export async function enrollMemberFace(input: EnrollMemberFaceInput): Promise<EnrollMemberFaceResultDto> {
  const parsed = enrollMemberFaceSchema.parse(input);
  const rpc = input.rpc ?? await createServerRpc();
  const { data, error } = await rpc("enroll_member_face", {
    p_gym_id: parsed.gymId,
    p_gym_member_id: parsed.gymMemberId,
    p_object_path: parsed.objectPath,
    p_mime_type: parsed.mimeType,
    p_size_bytes: parsed.sizeBytes,
    p_width_pixels: parsed.widthPixels ?? null,
    p_height_pixels: parsed.heightPixels ?? null,
    p_sha256_hex: parsed.sha256Hex ?? null,
    p_embedding: toVectorLiteral(parsed.embedding),
    p_quality_score: parsed.qualityScore ?? null,
    p_consent_version: parsed.consentVersion,
    p_model_code: parsed.modelCode,
  });

  if (error) {
    throw mapSupabaseError(error);
  }

  return data as EnrollMemberFaceResultDto;
}

function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

async function createServerRpc(): Promise<SupabaseRpc> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  return async (fn, args) => {
    const result = await supabase.rpc(fn as never, args as never);
    return result as { data: unknown; error: unknown };
  };
}
