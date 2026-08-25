#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkPendingMigrations } from "./lib/check-pending-migrations.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const ENV_EXAMPLE = resolve(REPO, ".env.example");
const MINIMUM_TOKEN_LENGTH = 32;

export function parseEnvExample(source) {
  const keys = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
    if (match) keys.push(match[1]);
  }
  return keys;
}

function result(ok, name, detail) {
  return { ok, name, detail: String(detail).replace(/\s+/g, " ").trim() };
}

function checkRequiredEnv(env, requiredKeys) {
  const missing = [];
  const placeholders = [];

  for (const key of requiredKeys) {
    const value = env[key]?.trim();
    if (!value) missing.push(key);
    else if (value.startsWith("replace-with")) placeholders.push(key);
  }

  const problems = [];
  if (missing.length > 0) problems.push(`faltan: ${missing.join(", ")}`);
  if (placeholders.length > 0) problems.push(`usan placeholder: ${placeholders.join(", ")}`);
  return problems.length > 0
    ? result(false, "variables de entorno", problems.join("; "))
    : result(true, "variables de entorno", `${requiredKeys.length} variables configuradas`);
}

function decodeJwtRole(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function checkPublicServiceRole(env) {
  const unsafe = Object.entries(env)
    .filter(([key, value]) => key.startsWith("NEXT_PUBLIC_") && typeof value === "string")
    .filter(([, value]) => decodeJwtRole(value) === "service_role")
    .map(([key]) => key);

  return unsafe.length > 0
    ? result(false, "service_role publica", `clave service_role en: ${unsafe.join(", ")}`)
    : result(true, "service_role publica", "ninguna variable publica contiene service_role");
}

function checkTokenLengths(env) {
  const tokenKeys = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "FACE_RECOGNITION_SERVICE_TOKEN",
    "STORAGE_DELETION_WORKER_TOKEN",
  ];
  const short = tokenKeys.filter((key) => (env[key]?.trim().length ?? 0) < MINIMUM_TOKEN_LENGTH);

  return short.length > 0
    ? result(false, "longitud de tokens", `menos de 32 caracteres: ${short.join(", ")}`)
    : result(true, "longitud de tokens", "los 3 tokens tienen 32 caracteres o mas");
}

function checkHttpsUrls(env) {
  const urlKeys = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL"];
  const invalid = [];

  for (const key of urlKeys) {
    try {
      const url = new URL(env[key]);
      const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if (!isLocal && url.protocol !== "https:") invalid.push(key);
    } catch {
      invalid.push(key);
    }
  }

  return invalid.length > 0
    ? result(false, "HTTPS", `URL invalida o sin https: ${invalid.join(", ")}`)
    : result(true, "HTTPS", "las URLs publicas usan un protocolo permitido");
}

function secondsSince(startedAt) {
  return ((performance.now() - startedAt) / 1000).toFixed(2);
}

async function checkFaceHealth(env, fetchImpl) {
  const startedAt = performance.now();
  try {
    const url = new URL("/health", env.FACE_RECOGNITION_SERVICE_URL);
    const response = await fetchImpl(url, { method: "GET" });
    const seconds = secondsSince(startedAt);
    return response.status === 200
      ? result(true, "servicio facial vivo", `respondio 200 en ${seconds} segundos`)
      : result(false, "servicio facial vivo", `respondio ${response.status} en ${seconds} segundos`);
  } catch (error) {
    return result(
      false,
      "servicio facial vivo",
      `no respondio en ${secondsSince(startedAt)} segundos: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function checkFaceProtection(env, fetchImpl) {
  try {
    const url = new URL("/embed", env.FACE_RECOGNITION_SERVICE_URL);
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageBase64: "a".repeat(32) }),
    });
    return response.status === 401
      ? result(true, "servicio facial protegido", "respondio 401 sin token")
      : result(false, "servicio facial protegido", "el servicio facial acepta peticiones sin token");
  } catch (error) {
    return result(
      false,
      "servicio facial protegido",
      `no respondio: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function runDeployPreflight({
  env = process.env,
  args = process.argv.slice(2),
  envExample = readFileSync(ENV_EXAMPLE, "utf8"),
  fetchImpl = fetch,
  migrationCheck = () => checkPendingMigrations({ repo: REPO }),
  logger = console,
} = {}) {
  const checks = [];
  const requiredKeys = parseEnvExample(envExample);

  checks.push(checkRequiredEnv(env, requiredKeys));
  checks.push(checkPublicServiceRole(env));
  checks.push(checkTokenLengths(env));
  checks.push(checkHttpsUrls(env));

  if (args.includes("--skip-remote")) {
    checks.push(result(true, "servicio facial vivo", "omitido por --skip-remote"));
    checks.push(result(true, "servicio facial protegido", "omitido por --skip-remote"));
  } else {
    checks.push(await checkFaceHealth(env, fetchImpl));
    checks.push(await checkFaceProtection(env, fetchImpl));
  }

  const migrations = await migrationCheck();
  checks.push(
    result(
      migrations.status === "pass",
      "migraciones",
      migrations.detail,
    ),
  );

  for (const check of checks) {
    const line = `${check.ok ? "OK" : "FALLA"} ${check.name}: ${check.detail}`;
    if (check.ok) logger.log(line);
    else logger.error(line);
  }

  return checks.some((check) => !check.ok) ? 1 : 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.exitCode = await runDeployPreflight();
}
