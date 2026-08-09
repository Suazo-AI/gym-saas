import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type StorageDeletionJob = {
  id: string;
  media_asset_id: string;
  gym_id: string;
  bucket_name: string;
  object_path: string;
};

export type StorageDeletionSummary = {
  claimed: number;
  completed: number;
  failed: number;
};

type RpcResult = Promise<{ data: unknown; error: unknown }>;

type WorkerClient = {
  rpc: (name: string, params?: Record<string, unknown>) => RpcResult;
  storage: {
    from: (bucket: string) => {
      remove: (paths: string[]) => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const RETRY_AFTER_SECONDS = 300;

export async function runStorageDeletionWorker(
  input: { limit?: number } = {},
): Promise<StorageDeletionSummary> {
  const supabase = createAdminClient() as unknown as WorkerClient;

  const claimed = await supabase.rpc("claim_storage_deletion_jobs", {
    p_limit: clampLimit(input.limit),
  });

  if (claimed.error) {
    throw new Error(`No se pudo reclamar la cola de borrado: ${describe(claimed.error)}`);
  }

  const jobs = (claimed.data ?? []) as StorageDeletionJob[];
  let completed = 0;
  let failed = 0;

  // Secuencial y a prueba de una falla: un trabajo roto no puede impedir que
  // los demas del lote se procesen, porque si no una sola fila envenenada
  // congela la cola entera.
  for (const job of jobs) {
    const rejected = tenantViolation(job);

    if (rejected) {
      await failJob(supabase, job, rejected);
      failed += 1;
      continue;
    }

    const removed = await supabase.storage.from(job.bucket_name).remove([job.object_path]);

    if (removed.error) {
      await failJob(supabase, job, describe(removed.error));
      failed += 1;
      continue;
    }

    const completedJob = await supabase.rpc("complete_storage_deletion_job", {
      p_job_id: job.id,
    });

    if (completedJob.error) {
      await failJob(supabase, job, describe(completedJob.error));
      failed += 1;
      continue;
    }

    completed += 1;
  }

  return { claimed: jobs.length, completed, failed };
}

/**
 * El worker corre con service_role, que saltea RLS por completo. La fila de la
 * cola no es una fuente confiable: se valida a mano que la ruta del objeto
 * pertenezca al gimnasio del propio trabajo, que es la regla del bucket segun
 * AGENTS.md. Sin esto, una fila con una ruta ajena seria un borrado arbitrario
 * y no habria RLS que lo frenara.
 */
function tenantViolation(job: StorageDeletionJob): string | null {
  if (!job.gym_id || !job.object_path) {
    return "El trabajo no declara gimnasio o ruta de objeto.";
  }

  if (!job.object_path.startsWith(`${job.gym_id}/`)) {
    return "La ruta del objeto no pertenece al gimnasio del trabajo.";
  }

  return null;
}

async function failJob(
  supabase: WorkerClient,
  job: StorageDeletionJob,
  reason: string,
): Promise<void> {
  await supabase.rpc("fail_storage_deletion_job", {
    p_job_id: job.id,
    p_error: reason,
    p_retry_after_seconds: RETRY_AFTER_SECONDS,
  });
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(Math.trunc(limit as number), MAX_LIMIT));
}

function describe(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "Error desconocido al borrar el objeto de Storage.";
}
