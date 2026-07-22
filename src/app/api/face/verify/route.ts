import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError } from "@/lib/api/api-error";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { requireUser } from "@/features/auth/services/auth.service";
import { generateFaceEmbedding } from "@/features/entries/services/face-embedding.service";
import { verifyFaceAccessWithEmbedding } from "@/features/entries/services/face-verification.repository";

const verifyFaceRequestSchema = z.object({
  imageBase64: z.string().min(32),
  branchId: z.string().uuid().nullable().optional(),
  deviceId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    await requireUser();
    const activeGym = await getActiveGym();

    if (!activeGym) {
      return NextResponse.json({ error: "No hay gimnasio activo." }, { status: 403 });
    }

    const parsed = verifyFaceRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "La imagen enviada no es valida." }, { status: 400 });
    }

    const embedding = await generateFaceEmbedding(parsed.data.imageBase64);
    const result = await verifyFaceAccessWithEmbedding({
      gymId: activeGym.gymId,
      branchId: parsed.data.branchId,
      deviceId: parsed.data.deviceId,
      embedding: embedding.embedding,
      processingMs: embedding.processingMs,
      modelCode: embedding.modelCode,
    });

    return NextResponse.json({
      ...result,
      qualityScore: embedding.qualityScore,
      faceCount: embedding.faceCount,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const status = error.code === "UNAUTHENTICATED" ? 401
        : error.code === "FORBIDDEN" ? 403
          : error.code === "VALIDATION_ERROR" ? 400
            : error.code === "BUSINESS_RULE_VIOLATION" ? 422
              : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    return NextResponse.json({ error: "No pudimos verificar el rostro." }, { status: 500 });
  }
}
