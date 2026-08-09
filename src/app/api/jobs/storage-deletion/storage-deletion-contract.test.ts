// CRITERIO DE ACEPTACION del worker de la cola de eliminacion de Storage.
//
// Escrito ANTES de la implementacion. Corrido dos veces antes de darlo por
// bueno: en rojo contra el codigo sin worker, y en verde contra la
// implementacion. Una prueba que no puede pasar con ninguna implementacion no
// es un criterio, es un bug con apariencia de rigor.
//
// Lo que este contrato exige que exista:
//
//   src/app/api/jobs/storage-deletion/route.ts
//     -> export async function POST(request: Request): Promise<Response>
//
//   src/lib/env.server.ts
//     -> getStorageWorkerEnv(): { STORAGE_DELETION_WORKER_TOKEN: string }
//
// El riesgo que estas pruebas existen para impedir es doble.
//
// Uno: que el endpoint quede abierto. Corre con service_role, que saltea RLS
// por completo, asi que sin autenticacion cualquiera podria vaciar Storage.
//
// Dos, y menos obvio: que el worker confie en la fila de la cola. La ruta del
// objeto tiene que empezar por el gym_id del propio trabajo, que es la regla de
// AGENTS.md para todo el bucket. Sin esa validacion, una fila con una ruta
// ajena convierte al worker en un borrado arbitrario, y como usa service_role
// no hay RLS que lo detenga.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Convencion del repositorio: "server-only" no esta instalado como paquete y
// los modulos de servidor lo importan, asi que los tests lo neutralizan.
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getStorageWorkerEnv: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/env.server", () => ({
  getStorageWorkerEnv: mocks.getStorageWorkerEnv,
  getServerEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-de-prueba",
  }),
}));

import { POST } from "./route";

const TOKEN = "worker-token-de-prueba-con-mas-de-32-caracteres";
const GYM_A = "20000000-0000-4000-8000-000000000001";
const GYM_B = "20000000-0000-4000-8000-000000000002";

type Job = {
  id: string;
  media_asset_id: string;
  gym_id: string;
  bucket_name: string;
  object_path: string;
};

const job = (id: string, gymId: string, objectPath: string): Job => ({
  id,
  media_asset_id: `media-${id}`,
  gym_id: gymId,
  bucket_name: "gym-media",
  object_path: objectPath,
});

// Doble del cliente de service_role. Anota lo que le piden y devuelve lo que se
// le configura, sin tocar nada real.
function adminDouble(options: { jobs?: Job[]; removeError?: unknown } = {}) {
  const jobs = options.jobs ?? [];

  const rpc = vi.fn(async (name: string) => {
    if (name === "claim_storage_deletion_jobs") {
      return { data: jobs, error: null };
    }
    return { data: null, error: null };
  });

  const remove = vi.fn(async () =>
    options.removeError
      ? { data: null, error: options.removeError }
      : { data: [{ name: "objeto" }], error: null },
  );

  const from = vi.fn(() => ({ remove }));

  mocks.createAdminClient.mockReturnValue({ rpc, storage: { from } });
  return { rpc, remove, from };
}

const rpcNames = (rpc: ReturnType<typeof vi.fn>) =>
  rpc.mock.calls.map((call) => call[0] as string);

const rpcArgs = (rpc: ReturnType<typeof vi.fn>, name: string) =>
  rpc.mock.calls.filter((call) => call[0] === name).map((call) => call[1]);

const request = (token?: string) =>
  new Request("http://localhost:3000/api/jobs/storage-deletion", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });

describe("worker de eliminacion de Storage: autenticacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStorageWorkerEnv.mockReturnValue({
      STORAGE_DELETION_WORKER_TOKEN: TOKEN,
    });
  });

  it("sin token responde 401 y no reclama ningun trabajo", async () => {
    const { rpc } = adminDouble({ jobs: [job("1", GYM_A, `${GYM_A}/a.webp`)] });

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("con un token que no coincide responde 401 y no reclama ningun trabajo", async () => {
    const { rpc } = adminDouble({ jobs: [job("1", GYM_A, `${GYM_A}/a.webp`)] });

    const response = await POST(request("otro-token-igual-de-largo-pero-distinto"));

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("worker de eliminacion de Storage: procesamiento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStorageWorkerEnv.mockReturnValue({
      STORAGE_DELETION_WORKER_TOKEN: TOKEN,
    });
  });

  it("reclama el lote con la RPC de la cola", async () => {
    const { rpc } = adminDouble({ jobs: [] });

    const response = await POST(request(TOKEN));

    expect(response.status).toBe(200);
    expect(rpcNames(rpc)).toContain("claim_storage_deletion_jobs");
  });

  it("borra el objeto del bucket del trabajo y lo marca completado", async () => {
    const target = job("job-1", GYM_A, `${GYM_A}/members/abc/foto.webp`);
    const { rpc, remove, from } = adminDouble({ jobs: [target] });

    await POST(request(TOKEN));

    expect(from).toHaveBeenCalledWith("gym-media");
    expect(remove).toHaveBeenCalledWith([target.object_path]);
    expect(rpcArgs(rpc, "complete_storage_deletion_job")).toContainEqual({
      p_job_id: target.id,
    });
    expect(rpcNames(rpc)).not.toContain("fail_storage_deletion_job");
  });

  it("cuando Storage falla marca el trabajo como fallido y no lo completa", async () => {
    const target = job("job-1", GYM_A, `${GYM_A}/members/abc/foto.webp`);
    const { rpc } = adminDouble({
      jobs: [target],
      removeError: { message: "el objeto no se pudo borrar" },
    });

    await POST(request(TOKEN));

    expect(rpcNames(rpc)).not.toContain("complete_storage_deletion_job");
    const failures = rpcArgs(rpc, "fail_storage_deletion_job") as Array<Record<string, unknown>>;
    expect(failures).toHaveLength(1);
    expect(failures[0].p_job_id).toBe(target.id);
    expect(String(failures[0].p_error)).toContain("el objeto no se pudo borrar");
  });

  it("rechaza un trabajo cuya ruta no empieza por su propio gimnasio, sin borrar nada", async () => {
    // service_role saltea RLS: si el worker confia en esta fila, borra un objeto
    // de otro gimnasio. Tiene que negarse antes de tocar Storage.
    const envenenado = job("job-1", GYM_A, `${GYM_B}/members/abc/foto.webp`);
    const { rpc, remove } = adminDouble({ jobs: [envenenado] });

    await POST(request(TOKEN));

    expect(remove).not.toHaveBeenCalled();
    expect(rpcNames(rpc)).not.toContain("complete_storage_deletion_job");
    expect(rpcArgs(rpc, "fail_storage_deletion_job")).toHaveLength(1);
  });

  it("un trabajo que falla no impide procesar el resto del lote", async () => {
    const envenenado = job("job-malo", GYM_A, `${GYM_B}/members/abc/foto.webp`);
    const sano = job("job-bueno", GYM_A, `${GYM_A}/members/def/foto.webp`);
    const { rpc, remove } = adminDouble({ jobs: [envenenado, sano] });

    await POST(request(TOKEN));

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([sano.object_path]);
    expect(rpcArgs(rpc, "complete_storage_deletion_job")).toContainEqual({
      p_job_id: sano.id,
    });
    expect(rpcArgs(rpc, "fail_storage_deletion_job")).toHaveLength(1);
  });
});

// F004. El worker le cree a la fila cual es el bucket y llama
// storage.from(job.bucket_name) sin validarlo. Corre con service_role, que
// saltea RLS por completo: una fila con otro bucket lo convierte en un borrado
// fuera de gym-media, que es el unico bucket del producto segun AGENTS.md.
//
// La validacion del prefijo de gimnasio ya existe y no cubre esto: una ruta
// puede empezar por el gym_id correcto y aun asi apuntar a otro bucket.
//
// El contrato exige lista blanca, no lista negra, y comparacion exacta. Un
// bucket desconocido se rechaza antes de tocar Storage, no despues.
describe("worker de eliminacion de Storage: lista blanca de bucket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStorageWorkerEnv.mockReturnValue({
      STORAGE_DELETION_WORKER_TOKEN: TOKEN,
    });
  });

  const enBucket = (base: Job, bucket: string): Job => ({
    ...base,
    bucket_name: bucket,
  });

  it("rechaza un trabajo que declara otro bucket, sin tocar Storage", async () => {
    const ajeno = enBucket(job("job-1", GYM_A, `${GYM_A}/members/abc/foto.webp`), "otro-bucket");
    const { rpc, remove, from } = adminDouble({ jobs: [ajeno] });

    await POST(request(TOKEN));

    expect(from).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(rpcNames(rpc)).not.toContain("complete_storage_deletion_job");
    expect(rpcArgs(rpc, "fail_storage_deletion_job")).toHaveLength(1);
  });

  it.each(["", "  ", "GYM-MEDIA", " gym-media", "gym-media/", "storage/gym-media"])(
    "rechaza el bucket %j: la comparacion es exacta, no aproximada",
    async (bucket) => {
      const ajeno = enBucket(job("job-1", GYM_A, `${GYM_A}/members/abc/foto.webp`), bucket);
      const { rpc, from } = adminDouble({ jobs: [ajeno] });

      await POST(request(TOKEN));

      expect(from).not.toHaveBeenCalled();
      expect(rpcArgs(rpc, "fail_storage_deletion_job")).toHaveLength(1);
    },
  );

  it("un bucket ajeno no impide procesar el resto del lote", async () => {
    const ajeno = enBucket(job("job-malo", GYM_A, `${GYM_A}/members/abc/foto.webp`), "otro-bucket");
    const sano = job("job-bueno", GYM_A, `${GYM_A}/members/def/foto.webp`);
    const { rpc, remove, from } = adminDouble({ jobs: [ajeno, sano] });

    await POST(request(TOKEN));

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("gym-media");
    expect(remove).toHaveBeenCalledWith([sano.object_path]);
    expect(rpcArgs(rpc, "complete_storage_deletion_job")).toContainEqual({
      p_job_id: sano.id,
    });
    expect(rpcArgs(rpc, "fail_storage_deletion_job")).toHaveLength(1);
  });

  it("el motivo del rechazo queda escrito en la cola y nombra al bucket", async () => {
    const ajeno = enBucket(job("job-1", GYM_A, `${GYM_A}/members/abc/foto.webp`), "otro-bucket");
    const { rpc } = adminDouble({ jobs: [ajeno] });

    await POST(request(TOKEN));

    const failures = rpcArgs(rpc, "fail_storage_deletion_job") as Array<Record<string, unknown>>;
    expect(failures).toHaveLength(1);
    expect(failures[0].p_job_id).toBe(ajeno.id);
    expect(String(failures[0].p_error)).toContain("bucket");
  });
});
