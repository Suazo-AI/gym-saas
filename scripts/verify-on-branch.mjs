#!/usr/bin/env node
// verify-on-branch - lo que ejecutan los hooks de git.
//
// Averigua que paquete del manifiesto corresponde a la rama actual y lo
// verifica. Se invoca con "post-commit" o con "pre-push".
//
//   post-commit  anota el veredicto en verification/watch.log y sale 0 siempre.
//                Observar no puede romperle el commit a nadie.
//   pre-push     sale 1 si el veredicto es FAIL, para frenar la publicacion.
//
// Solo corre verificaciones estructurales, que son puro git e instantaneas.
// Nadie tolera un hook que tarda dos minutos, y un hook lento se termina
// desactivando, que es la peor forma de perder un control.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(REPO, "verification", "packages.json");
const LOG = join(REPO, "verification", "watch.log");
const mode = process.argv[2] ?? "post-commit";

const git = (args) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
};

const note = (line) => {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, `${line}\n`, "utf8");
  } catch {
    // Si no se puede anotar, no se rompe nada mas.
  }
};

const done = (code) => process.exit(mode === "pre-push" ? code : 0);

if (!existsSync(MANIFEST)) done(0);

const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
if (!branch || branch === "HEAD") done(0);

let pkg;
try {
  pkg = JSON.parse(readFileSync(MANIFEST, "utf8")).packages.find((p) => p.branch === branch);
} catch {
  done(0);
}

// Una rama sin paquete declarado no se verifica. No todo commit pertenece a un
// paquete, y un hook que se queja de todo se vuelve ruido.
if (!pkg) done(0);

const when = git(["log", "-1", "--format=%cI", "HEAD"]) ?? "";
const head = (git(["rev-parse", "HEAD"]) ?? "").slice(0, 7);

try {
  execFileSync("node", [join(REPO, "scripts", "verify-package.mjs"), pkg.id], {
    cwd: REPO,
    stdio: "ignore",
  });
} catch {
  // El verificador sale 1 cuando hay fallas. Eso no es un error de ejecucion:
  // el veredicto real se lee del JSON, abajo.
}

const resultPath = join(REPO, "verification", "results", `${pkg.id}.json`);
if (!existsSync(resultPath)) {
  note(`${when}  ERROR   ${pkg.id} ${head} el verificador no dejo veredicto`);
  done(0);
}

const result = JSON.parse(readFileSync(resultPath, "utf8"));
const fallas = result.checks.filter((c) => c.status === "FAIL").map((c) => c.name);

if (result.verdict === "PASS") {
  note(`${when}  VERDE   ${pkg.id} ${head} ${mode}`);
  done(0);
}

note(`${when}  ROJO    ${pkg.id} ${head} ${mode} -> ${fallas.join(", ")}`);

if (mode === "pre-push") {
  console.error(`\nPush bloqueado: el paquete ${pkg.id} (${pkg.name}) tiene veredicto FAIL.\n`);
  for (const f of fallas) console.error(`  - ${f}`);
  console.error(`\nDetalle en verification/results/${pkg.id}.json`);
  console.error(`Para publicar igual, a sabiendas: git push --no-verify\n`);
}

done(1);
