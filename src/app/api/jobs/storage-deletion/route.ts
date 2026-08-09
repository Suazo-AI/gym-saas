import { timingSafeEqual } from "node:crypto";

import { runStorageDeletionWorker } from "@/features/storage/services/storage-deletion.worker";
import { getStorageWorkerEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const { STORAGE_DELETION_WORKER_TOKEN } = getStorageWorkerEnv();

  if (!isAuthorized(request.headers.get("authorization"), STORAGE_DELETION_WORKER_TOKEN)) {
    return Response.json(
      { error: "UNAUTHORIZED" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const summary = await runStorageDeletionWorker();

  return Response.json(summary, { status: 200 });
}

function isAuthorized(authorization: string | null, expectedToken: string): boolean {
  if (!authorization) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${expectedToken}`, "utf8");
  const received = Buffer.from(authorization, "utf8");

  // timingSafeEqual exige el mismo largo, y comparar largos primero no filtra
  // el secreto: el largo del encabezado ya es publico.
  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}
