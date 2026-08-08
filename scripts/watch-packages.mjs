#!/usr/bin/env node
// watch-packages - dispara la verificacion cuando una rama del manifiesto cambia.
//
// Por que un programa y no un agente vigilando: mirar cuesta tokens cada vez.
// Esto cuesta cero y no se cansa. Y no es un temporizador sino un disparador:
// reacciona al commit, no al reloj.
//
// Uso:
//   node scripts/watch-packages.mjs [--interval 60] [--full]
//
// Escribe una linea por evento en verification/watch.log y deja el veredicto
// completo en verification/results/<id>.json. Solo hay que leer el log.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(REPO, "verification", "packages.json");
const LOG = join(REPO, "verification", "watch.log");

const argv = process.argv.slice(2);
const full = argv.includes("--full");
const intervalArg = argv.indexOf("--interval");
const intervalMs = (intervalArg >= 0 ? Number(argv[intervalArg + 1]) : 60) * 1000;

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, {
      cwd: REPO,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
};

const stamp = () => run("git", ["log", "-1", "--format=%cI", "HEAD"]) ?? "";

function log(line) {
  mkdirSync(dirname(LOG), { recursive: true });
  appendFileSync(LOG, `${line}\n`, "utf8");
  console.log(line);
}

const seen = new Map();
let firstPass = true;

log(`--- watcher arrancado, intervalo ${intervalMs / 1000}s, modo ${full ? "full" : "estructural"} ---`);

// Bucle deliberadamente simple. Si el proceso muere, no se pierde nada:
// el estado real vive en git, y al arrancar de nuevo vuelve a leerlo.
for (;;) {
  if (!existsSync(MANIFEST)) {
    log(`${stamp()}  ERROR  no existe ${MANIFEST}`);
    break;
  }

  const packages = JSON.parse(readFileSync(MANIFEST, "utf8")).packages;

  for (const pkg of packages) {
    const head = run("git", ["rev-parse", "--verify", `${pkg.branch}^{commit}`]);
    if (!head) continue;

    const previous = seen.get(pkg.id);
    seen.set(pkg.id, head);

    // En la primera vuelta solo se toma nota, para no re-verificar todo el
    // historial cada vez que se reinicia el watcher.
    if (firstPass || previous === head) continue;

    const short = head.slice(0, 7);
    log(`${stamp()}  CAMBIO  ${pkg.id} ${pkg.branch} -> ${short}, verificando`);

    const args = ["scripts/verify-package.mjs", pkg.id];
    if (full) args.push("--full");
    run("node", args);

    const resultPath = join(REPO, "verification", "results", `${pkg.id}.json`);
    if (!existsSync(resultPath)) {
      log(`${stamp()}  ERROR   ${pkg.id} el verificador no dejo veredicto`);
      continue;
    }

    const result = JSON.parse(readFileSync(resultPath, "utf8"));
    const fallas = result.checks
      .filter((c) => c.status === "FAIL")
      .map((c) => c.name)
      .join(", ");

    log(
      result.verdict === "PASS"
        ? `${stamp()}  VERDE   ${pkg.id} ${short} (${result.mode})`
        : `${stamp()}  ROJO    ${pkg.id} ${short} -> ${fallas}`,
    );
  }

  firstPass = false;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, intervalMs);
}
