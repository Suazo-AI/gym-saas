import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runDeployPreflight } from "./deploy-preflight.mjs";

const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
const validEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-12345678901234567890",
  FACE_RECOGNITION_SERVICE_URL: "http://127.0.0.1:8010",
  FACE_RECOGNITION_SERVICE_TOKEN: "face-service-test-token-1234567890",
  STORAGE_DELETION_WORKER_TOKEN: "storage-worker-test-token-123456789",
};

const migrationCheck = vi.fn(async () => ({
  status: "pass",
  detail: "50 migraciones versionadas, ninguna pendiente",
}));

function jwt(payload) {
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "firma",
  ].join(".");
}

async function run(env) {
  return runDeployPreflight({
    env,
    args: ["--skip-remote"],
    envExample,
    migrationCheck,
    logger: { log: vi.fn(), error: vi.fn() },
  });
}

describe("deploy preflight", () => {
  beforeEach(() => {
    migrationCheck.mockClear();
  });

  it("sale 1 cuando falta una variable requerida", async () => {
    const env = { ...validEnv };
    delete env.NEXT_PUBLIC_SITE_URL;

    await expect(run(env)).resolves.toBe(1);
  });

  it("sale 1 cuando una variable conserva un placeholder", async () => {
    await expect(
      run({ ...validEnv, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "replace-with-key" }),
    ).resolves.toBe(1);
  });

  it("sale 1 cuando una variable publica lleva un JWT service_role", async () => {
    await expect(
      run({ ...validEnv, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt({ role: "service_role" }) }),
    ).resolves.toBe(1);
  });

  it("sale 1 cuando un token tiene menos de 32 caracteres", async () => {
    await expect(
      run({ ...validEnv, FACE_RECOGNITION_SERVICE_TOKEN: "muy-corto" }),
    ).resolves.toBe(1);
  });

  it("sale 1 con NEXT_PUBLIC_SITE_URL en http fuera de localhost", async () => {
    await expect(
      run({ ...validEnv, NEXT_PUBLIC_SITE_URL: "http://fitmanager.example" }),
    ).resolves.toBe(1);
  });

  it("sale 0 cuando todo esta correcto con --skip-remote", async () => {
    await expect(run({ ...validEnv })).resolves.toBe(0);
  });
});
