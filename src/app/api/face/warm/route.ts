import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/api-error";
import { getActiveGym } from "@/features/gyms/services/get-active-gym";
import { requireGymPermission } from "@/features/gyms/services/require-gym-permission";
import { requireApiUser } from "@/features/auth/services/auth.service";
import { getFaceServiceEnv } from "@/lib/env.server";

const FACE_SERVICE_WARM_TIMEOUT_MS = 35_000;

export async function GET() {
  try {
    await requireApiUser();
    const activeGym = await getActiveGym();

    if (!activeGym) {
      return NextResponse.json({ error: "No hay gimnasio activo." }, { status: 403 });
    }

    await requireGymPermission(activeGym.gymId, "faces.verify");

    const startedAt = Date.now();

    try {
      const faceServiceEnv = getFaceServiceEnv();
      const response = await fetch(
        new URL("/health", faceServiceEnv.FACE_RECOGNITION_SERVICE_URL),
        {
          method: "GET",
          headers: {
            authorization: `Bearer ${faceServiceEnv.FACE_RECOGNITION_SERVICE_TOKEN}`,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(FACE_SERVICE_WARM_TIMEOUT_MS),
        },
      );
      const ms = Date.now() - startedAt;

      return NextResponse.json(
        { ok: response.ok, ms },
        { status: response.ok ? 200 : 503 },
      );
    } catch {
      return NextResponse.json(
        { ok: false, ms: Date.now() - startedAt },
        { status: 503 },
      );
    }
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

    return NextResponse.json({ error: "No pudimos despertar el servicio facial." }, { status: 500 });
  }
}
