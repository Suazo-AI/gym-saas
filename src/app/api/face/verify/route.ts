import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError } from "@/lib/api/api-error";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { requireGymPermission } from "@/features/gyms/services/require-gym-permission";
import { requireApiUser } from "@/features/auth/services/auth.service";
import { generateFaceEmbedding } from "@/features/entries/services/face-embedding.service";
import { reserveFaceVerificationAttempt } from "@/features/entries/services/face-verification-rate-limit";
import { verifyFaceAccessWithEmbedding } from "@/features/entries/services/face-verification.repository";
import { getMember } from "@/features/members/services/member.repository";

const MAX_IMAGE_BASE64_LENGTH = 2_800_000;
const MAX_REQUEST_BYTES = 3 * 1024 * 1024;

const verifyFaceRequestSchema = z.object({
  imageBase64: z
    .string()
    .min(32)
    .max(MAX_IMAGE_BASE64_LENGTH),
  branchId: z.string().uuid().nullable().optional(),
  deviceId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length"));

    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { error: "La imagen supera el tamano permitido." },
        { status: 413 },
      );
    }

    await requireApiUser();
    const activeGym = await getActiveGym();

    if (!activeGym) {
      return NextResponse.json({ error: "No hay gimnasio activo." }, { status: 403 });
    }

    await requireGymPermission(activeGym.gymId, "faces.verify");

    const parsed = verifyFaceRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "La imagen enviada no es valida." }, { status: 400 });
    }

    await reserveFaceVerificationAttempt(activeGym.gymId);

    const embedding = await generateFaceEmbedding(parsed.data.imageBase64);
    const result = await verifyFaceAccessWithEmbedding({
      gymId: activeGym.gymId,
      branchId: parsed.data.branchId,
      deviceId: parsed.data.deviceId,
      embedding: embedding.embedding,
      processingMs: embedding.processingMs,
      modelCode: embedding.modelCode,
    });
    const member = result.gymMemberId
      ? await getMember({ gymId: activeGym.gymId, gymMemberId: result.gymMemberId })
      : null;

    return NextResponse.json({
      ...result,
      member: member
        ? {
            gymMemberId: member.gymMemberId,
            fullName: member.fullName,
            memberCode: member.memberCode,
          }
        : null,
      qualityScore: embedding.qualityScore,
      faceCount: embedding.faceCount,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const status = error.code === "UNAUTHENTICATED" ? 401
        : error.code === "FORBIDDEN" ? 403
          : error.code === "VALIDATION_ERROR" ? 400
            : error.code === "RATE_LIMITED" ? 429
              : error.code === "BUSINESS_RULE_VIOLATION" ? 422
                : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    return NextResponse.json({ error: "No pudimos verificar el rostro." }, { status: 500 });
  }
}
