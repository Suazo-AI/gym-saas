import crypto from "node:crypto";

import { ApiError } from "@/lib/api/api-error";
import { mapSupabaseError } from "@/lib/api/map-supabase-error";

import { enrollMemberFace } from "./member-face-enrollment.repository";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MIME_EXTENSION: Record<string, "webp" | "jpg" | "png"> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export type FaceEnrollmentFormInput = {
  gymId: string;
  gymMemberId: string;
  imageBase64?: string;
  biometricConsentGranted: boolean;
  widthPixels?: number | null;
  heightPixels?: number | null;
};

export type FaceEnrollmentStatus =
  | { status: "skipped" }
  | { status: "enrolled"; faceEmbeddingId: string; mediaAssetId: string };

export async function enrollMemberFaceFromForm(input: FaceEnrollmentFormInput): Promise<FaceEnrollmentStatus> {
  if (!input.imageBase64) {
    return { status: "skipped" };
  }

  if (!input.biometricConsentGranted) {
    throw new ApiError("VALIDATION_ERROR", "Para usar reconocimiento facial se necesita consentimiento biometrico.");
  }

  const image = parseFaceImageDataUrl(input.imageBase64);
  const extension = MIME_EXTENSION[image.mimeType];
  const objectPath = `${input.gymId}/members/${input.gymMemberId}/${crypto.randomUUID()}.${extension}`;
  const sha256Hex = crypto.createHash("sha256").update(image.bytes).digest("hex");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("gym-media")
    .upload(objectPath, Buffer.from(image.bytes), {
      contentType: image.mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw mapSupabaseError(uploadError);
  }

  try {
    const { generateFaceEmbedding } = await import("@/features/entries/services/face-embedding.service");
    const embedding = await generateFaceEmbedding(input.imageBase64);
    const enrollment = await enrollMemberFace({
      gymId: input.gymId,
      gymMemberId: input.gymMemberId,
      objectPath,
      mimeType: image.mimeType,
      sizeBytes: image.bytes.byteLength,
      widthPixels: input.widthPixels ?? null,
      heightPixels: input.heightPixels ?? null,
      sha256Hex,
      embedding: embedding.embedding,
      qualityScore: embedding.qualityScore,
      biometricConsentGranted: true,
      modelCode: embedding.modelCode,
    });

    return {
      status: "enrolled",
      faceEmbeddingId: enrollment.faceEmbeddingId,
      mediaAssetId: enrollment.mediaAssetId,
    };
  } catch (error) {
    await supabase.storage.from("gym-media").remove([objectPath]);
    throw error;
  }
}

export function parseFaceImageDataUrl(dataUrl: string): { mimeType: "image/webp" | "image/jpeg" | "image/png"; bytes: Uint8Array } {
  const match = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);

  if (!match) {
    if (dataUrl.startsWith("data:image/")) {
      throw new ApiError("VALIDATION_ERROR", "La foto debe ser WebP, JPEG o PNG.");
    }

    throw new ApiError("VALIDATION_ERROR", "La foto enviada no es valida.");
  }

  const bytes = Buffer.from(match[2], "base64");

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new ApiError("VALIDATION_ERROR", "La foto debe pesar menos de 10 MB.");
  }

  return {
    mimeType: match[1] as "image/webp" | "image/jpeg" | "image/png",
    bytes,
  };
}
