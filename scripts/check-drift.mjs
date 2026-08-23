#!/usr/bin/env node
// check-drift - barreras contra los errores que vuelven solos.
//
// Un arreglo que vive en la cabeza de alguien dura hasta que esa cabeza se
// distrae. Un arreglo que vive en un programa que corre solo es permanente.
// Este archivo es donde se guardan los segundos.
//
// Cada revision de aca nacio de un problema que ya mordio una vez. La regla
// para agregar una nueva: paso de verdad, se puede decidir con un booleano y
// nadie la esta mirando hoy.
//
// FALLA (exit 1)  lo que rompe el trabajo de otro o corrompe datos.
// AVISA (exit 0)  lo que solo te hace perder tiempo a vos.
//
// Uso:  node scripts/check-drift.mjs
//       node scripts/check-drift.mjs --strict   (los avisos tambien fallan)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STRICT = process.argv.includes("--strict");

const failures = [];
const warnings = [];
const passes = [];

function fail(check, detail) {
  failures.push({ check, detail });
}

function warn(check, detail) {
  warnings.push({ check, detail });
}

function pass(check, detail) {
  passes.push({ check, detail });
}

function run(cmd, args, opts = {}) {
  try {
    return {
      ok: true,
      out: execFileSync(cmd, args, {
        cwd: REPO,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        ...opts,
      }),
    };
  } catch (error) {
    return { ok: false, out: error.stdout ?? "", err: error.stderr ?? String(error) };
  }
}

// ---------------------------------------------------------------------------
// 1. FALLA: la dimension del embedding facial vive en cinco archivos sueltos.
//
// Ya se rompio una vez (4865e98, un cambio a 128 sin migracion que hubo que
// revertir). Ningun embedding de 512 se puede comparar con uno de 128, asi que
// una desalineacion silenciosa invalida el reconocimiento facial entero.
// ---------------------------------------------------------------------------
const DIMENSION_SITES = [
  {
    file: "services/face-recognition/app.py",
    pattern: /embedding\.shape\[0\]\s*!=\s*(\d+)/,
  },
  {
    file: "src/features/members/services/member-face-enrollment.repository.ts",
    pattern: /\.length\((\d+),/,
  },
  {
    file: "src/features/entries/services/face-verification.repository.ts",
    pattern: /input\.embedding\.length\s*!==\s*(\d+)/,
  },
  {
    file: "src/features/entries/services/face-embedding.service.ts",
    pattern: /data\.embedding\.length\s*!==\s*(\d+)/,
  },
  {
    file: "supabase/migrations/20260808050000_sface_128_dimensions.sql",
    pattern: /vector\((\d+)\)/,
  },
];

function checkFaceDimensions() {
  const found = [];
  for (const site of DIMENSION_SITES) {
    const path = join(REPO, site.file);
    if (!existsSync(path)) {
      fail(
        "dimension facial",
        `falta ${site.file}. Si el archivo se movio, actualizar DIMENSION_SITES en scripts/check-drift.mjs.`,
      );
      return;
    }
    const match = readFileSync(path, "utf8").match(site.pattern);
    if (!match) {
      fail(
        "dimension facial",
        `no se encontro la dimension en ${site.file}. El patron de check-drift quedo viejo.`,
      );
      return;
    }
    found.push({ file: site.file, value: Number(match[1]) });
  }

  const values = new Set(found.map((f) => f.value));
  if (values.size === 1) {
    pass("dimension facial", `${found.length} archivos declaran ${[...values][0]} dimensiones`);
    return;
  }

  const detail = found.map((f) => `  ${f.value.toString().padStart(4)}  ${f.file}`).join("\n");
  fail(
    "dimension facial",
    `los archivos no coinciden. Cambiar la dimension exige tocar los cinco y una migracion completa:\n${detail}`,
  );
}

// ---------------------------------------------------------------------------
// 2. FALLA: migracion aplicada al repositorio pero no a la base local.
//
// Hallazgo A4 del recorrido con usuarios del 2026-08-21. La migracion
// 20260810200000_overdue_access_policy.sql estaba pendiente y bloqueo la
// seleccion de miembro para entrada. La tarea tardo 255 segundos en vez de 60
// y nada aviso: la pantalla simplemente no funcionaba.
//
// Se saltea cuando no hay stack local que consultar, porque en CI la base se
// levanta desde cero y esta al dia por construccion.
// ---------------------------------------------------------------------------
// El CLI de supabase es una devDependency, no esta en el PATH del sistema.
// Buscarlo por nombre pelado devuelve siempre "no se pudo consultar", que es
// una barrera que miente en verde. Se resuelve desde node_modules/.bin.
//
// En Windows, Node 24 rechaza ejecutar un .cmd directamente (endurecimiento por
// CVE-2024-27980) y hay que pasar por el interprete de comandos. Es el mismo
// tropiezo que ya documenta verification/CONTRATO.md: sin esto la revision no
// arranca nunca y se reporta como "sin veredicto" para siempre.
const IS_WIN = process.platform === "win32";

function supabaseCommand() {
  const base = join(REPO, "node_modules", ".bin");
  if (IS_WIN && existsSync(join(base, "supabase.cmd"))) {
    return {
      bin: process.env.COMSPEC || "cmd.exe",
      prefix: ["/d", "/s", "/c", join(base, "supabase.cmd")],
    };
  }
  if (existsSync(join(base, "supabase"))) {
    return { bin: join(base, "supabase"), prefix: [] };
  }
  return null;
}

function checkPendingMigrations() {
  const cli = supabaseCommand();
  if (!cli) {
    warn(
      "migraciones locales",
      "no se encontro el CLI de supabase en node_modules/.bin. Correr npm ci.",
    );
    return;
  }

  const listed = run(cli.bin, [...cli.prefix, "migration", "list", "--local"]);
  const out = `${listed.out}${listed.err ?? ""}`;

  // El CLI imprime el error y sale con codigo 0 cuando no hay base a la que
  // conectarse. Confiar en el exit code deja pasar una salida vacia como
  // "cero pendientes", que es un verde inventado. Se exige el JSON real.
  // Cada fila del JSON es {local, remote}: `local` es el archivo versionado en
  // supabase/migrations y `remote` es la version aplicada en la base. Una fila
  // con `local` lleno y `remote` vacio es exactamente el caso A4: el archivo
  // esta en el repositorio y la base no lo corrio.
  const pending = [];
  let total = 0;
  let parsed = false;
  for (const line of out.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let payload;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!Array.isArray(payload.migrations)) continue;
    parsed = true;
    for (const row of payload.migrations) {
      if (typeof row.local !== "string" || row.local === "") continue;
      total += 1;
      if (!row.remote) pending.push(row.local);
    }
  }

  if (!parsed) {
    const reason = /Failed to connect|LegacyDbConnectError/.test(out)
      ? "el stack local no responde. Levantarlo con:  npx supabase start"
      : "no se pudo leer la lista de migraciones del CLI";
    warn("migraciones locales", `${reason}. Sin veredicto.`);
    return;
  }

  if (pending.length === 0) {
    pass("migraciones locales", `${total} migraciones versionadas, ninguna pendiente`);
    return;
  }

  fail(
    "migraciones locales",
    `${pending.length} de ${total} migracion(es) versionadas que la base local no aplico: ${pending.sort().join(", ")}.\n` +
      "  Aplicar con:  npx supabase migration up  (o  npx supabase db reset  si podes perder los datos locales)",
  );
}

// ---------------------------------------------------------------------------
// 3. AVISA: trabajo sin commitear.
//
// El 2026-08-21 las correcciones A1, A2 y A5 pasaron un dia entero sueltas en
// el arbol de trabajo de main. Un checkout distraido y se perdian. Avisa y no
// falla, porque preflight se corre justamente antes de commitear.
// ---------------------------------------------------------------------------
function checkUncommittedWork() {
  const status = run("git", ["status", "--porcelain", "--untracked-files=no"]);
  if (!status.ok) {
    warn("trabajo sin commitear", "no se pudo leer el estado de git");
    return;
  }

  const dirty = status.out.split("\n").filter((l) => l.trim() !== "");
  if (dirty.length === 0) {
    pass("trabajo sin commitear", "el arbol esta limpio");
    return;
  }

  const branch = run("git", ["branch", "--show-current"]).out.trim() || "(sin rama)";
  warn(
    "trabajo sin commitear",
    `${dirty.length} archivo(s) modificados en ${branch} sin commitear. Nada los protege todavia.`,
  );
}

// ---------------------------------------------------------------------------
// 4. AVISA: el grafo de conocimiento quedo viejo.
//
// graphify-out/graph.json es lo que responde las preguntas de arquitectura. Un
// grafo mas viejo que el ultimo commit contesta sobre codigo que ya no existe,
// y lo hace con la misma seguridad que si estuviera al dia.
// ---------------------------------------------------------------------------
function checkGraphFreshness() {
  const graph = join(REPO, "graphify-out", "graph.json");
  if (!existsSync(graph)) {
    pass("grafo de conocimiento", "no hay grafo que envejecer");
    return;
  }

  const lastCommit = run("git", ["log", "-1", "--format=%ct"]);
  if (!lastCommit.ok) {
    warn("grafo de conocimiento", "no se pudo leer la fecha del ultimo commit");
    return;
  }

  const graphTime = Math.floor(statSync(graph).mtimeMs / 1000);
  const commitTime = Number(lastCommit.out.trim());
  if (graphTime >= commitTime) {
    pass("grafo de conocimiento", "el grafo es mas nuevo que el ultimo commit");
    return;
  }

  const days = Math.floor((commitTime - graphTime) / 86400);
  warn(
    "grafo de conocimiento",
    `el grafo quedo ${days} dia(s) atras del ultimo commit. Actualizar con:  graphify . --update`,
  );
}

// ---------------------------------------------------------------------------

checkFaceDimensions();
checkPendingMigrations();
checkUncommittedWork();
checkGraphFreshness();

for (const p of passes) console.log(`  OK    ${p.check}: ${p.detail}`);
for (const w of warnings) console.log(`  AVISO ${w.check}: ${w.detail}`);
for (const f of failures) console.error(`  FALLA ${f.check}: ${f.detail}`);

const hardFailures = failures.length + (STRICT ? warnings.length : 0);
if (hardFailures > 0) {
  console.error(`\ncheck-drift: ${hardFailures} problema(s). Ver arriba.`);
  process.exit(1);
}

console.log(
  `\ncheck-drift: ${passes.length} en verde, ${warnings.length} aviso(s), 0 fallas.`,
);
