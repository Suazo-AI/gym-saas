#!/usr/bin/env node
// verify-package - emite el veredicto de un paquete de trabajo delegado.
//
// Principio: el agente que hizo el trabajo NO reporta su propio estado.
// Produce un commit. Este programa, que el agente no ejecuta ni edita,
// decide si ese commit cumple o no. Todo lo que verifica es booleano y
// determinista: no hay juicio, no hay "parece correcto".
//
// Uso:
//   node scripts/verify-package.mjs <id-del-paquete> [--full] [--with-db]
//   node scripts/verify-package.mjs --all [--full] [--with-db]
//
//   (sin flags)  solo verificaciones estructurales: instantaneas, puro git
//   --full       ademas crea un worktree aislado, npm ci y npm run preflight
//   --with-db    ademas npm run test:db (requiere stack Supabase disponible)
//
// Salida: tabla legible + verification/results/<id>.json con el veredicto
// y el SHA del commit juzgado. Exit code 1 si algo falla.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(REPO, "verification", "packages.json");
const RESULTS = join(REPO, "verification", "results");

// --- utilidades ---------------------------------------------------------

function git(args, opts = {}) {
  return execFileSync("git", args, {
    cwd: opts.cwd ?? REPO,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).trimEnd();
}

function gitOk(args, opts = {}) {
  try {
    git(args, opts);
    return true;
  } catch {
    return false;
  }
}

// Matcher minimo de globs: soporta ** y *. Sin dependencias a proposito,
// para que este verificador no herede la superficie de ataque de npm.
function globToRegExp(pattern) {
  let out = "^";
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        out += ".*";
        i += 1;
        if (pattern[i + 1] === "/") i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (".+^${}()|[]\\".includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`${out}$`);
}

const matchesAny = (path, patterns) =>
  patterns.some((p) => globToRegExp(p).test(path));

// Se normalizan los finales de linea antes de hashear. En Windows git convierte
// LF a CRLF al materializar el archivo, y sin esto el congelado fallaria por una
// diferencia que no cambia una sola instruccion del codigo.
const sha256 = (text) =>
  createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");

// --- verificaciones -----------------------------------------------------

class Report {
  constructor(pkg) {
    this.pkg = pkg;
    this.checks = [];
  }

  add(name, ok, detail) {
    this.checks.push({ name, status: ok ? "PASS" : "FAIL", detail });
    return ok;
  }

  skip(name, detail) {
    this.checks.push({ name, status: "SKIP", detail });
  }

  get failed() {
    return this.checks.filter((c) => c.status === "FAIL");
  }

  get verdict() {
    return this.failed.length === 0 ? "PASS" : "FAIL";
  }
}

function structuralChecks(pkg, report) {
  const { branch, base } = pkg;

  if (!gitOk(["rev-parse", "--verify", `${branch}^{commit}`])) {
    report.add("rama existe", false, `no existe la rama ${branch}`);
    return null;
  }
  report.add("rama existe", true, branch);

  const head = git(["rev-parse", branch]);
  const baseSha = git(["rev-parse", base]);

  // La rama tiene que salir de la base declarada. Si no, se esta juzgando
  // un diff contra algo que no es lo que creemos.
  report.add(
    "base correcta",
    gitOk(["merge-base", "--is-ancestor", baseSha, head]),
    `${base} (${baseSha.slice(0, 7)}) es ancestro de ${head.slice(0, 7)}`,
  );

  const commits = git(["log", "--format=%H%x00%s%x00%b%x1e", `${baseSha}..${head}`])
    .split("\x1e")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [hash, subject, body] = c.split("\x00");
      return { hash, subject, body: body ?? "" };
    });

  report.add(
    "cantidad de commits",
    commits.length > 0 && commits.length <= pkg.maxCommits,
    `${commits.length} commit(s), maximo permitido ${pkg.maxCommits}`,
  );

  // Firmas de agente prohibidas en los mensajes de commit.
  const FORBIDDEN_TRAILERS = [/co-authored-by/i, /generated with/i, /\bclaude\b/i, /\bcodex\b/i];
  const dirty = commits.filter((c) =>
    FORBIDDEN_TRAILERS.some((re) => re.test(`${c.subject}\n${c.body}`)),
  );
  report.add(
    "commits sin firma de agente",
    dirty.length === 0,
    dirty.length ? dirty.map((c) => `${c.hash.slice(0, 7)} ${c.subject}`).join("; ") : "limpio",
  );

  // Alcance: cada archivo tocado tiene que estar declarado en el manifiesto.
  const changed = git(["diff", "--name-only", baseSha, head]).split("\n").filter(Boolean);
  const outside = changed.filter((f) => !matchesAny(f, pkg.allowedPaths));
  report.add(
    "sin archivos fuera de alcance",
    outside.length === 0,
    outside.length ? outside.join(", ") : `${changed.length} archivo(s), todos declarados`,
  );

  // Nadie edita una migracion ya aplicada: solo se agregan archivos nuevos.
  const touched = git(["diff", "--name-status", baseSha, head])
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [status, ...rest] = l.split("\t");
      return { status: status[0], path: rest[rest.length - 1] };
    });
  const mutated = touched.filter(
    (t) => t.status !== "A" && matchesAny(t.path, pkg.appendOnlyPaths ?? []),
  );
  report.add(
    "migraciones existentes intactas",
    mutated.length === 0,
    mutated.length
      ? mutated.map((m) => `${m.status} ${m.path}`).join(", ")
      : "solo archivos nuevos en rutas append-only",
  );

  // Timestamp de migracion nueva posterior a todas las existentes.
  const migrationTs = (list) =>
    list
      .map((f) => /supabase\/migrations\/(\d{14})_/.exec(f)?.[1])
      .filter(Boolean)
      .map(Number);
  const baseMigrations = migrationTs(
    git(["ls-tree", "-r", "--name-only", baseSha, "--", "supabase/migrations"]).split("\n"),
  );
  const newMigrations = migrationTs(touched.filter((t) => t.status === "A").map((t) => t.path));
  if (newMigrations.length) {
    const maxBase = Math.max(0, ...baseMigrations);
    report.add(
      "timestamps de migracion posteriores",
      newMigrations.every((t) => t > maxBase),
      `nuevas ${newMigrations.join(", ")} vs maxima existente ${maxBase}`,
    );
  } else {
    report.skip("timestamps de migracion posteriores", "el paquete no agrega migraciones");
  }

  // Archivos congelados: criterios de aceptacion que el ejecutor no puede editar.
  const frozen = Object.entries(pkg.frozenFiles ?? {});
  if (frozen.length) {
    const tampered = frozen.filter(([path, expected]) => {
      // Sin trimEnd: el salto de linea final es parte del archivo, y recortarlo
      // hacia que el hash nunca coincidiera con el del archivo en disco.
      let content = "";
      try {
        content = execFileSync("git", ["show", `${head}:${path}`], {
          cwd: REPO,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          maxBuffer: 64 * 1024 * 1024,
        });
      } catch {
        return true;
      }
      return sha256(content) !== expected;
    });
    report.add(
      "criterios de aceptacion sin modificar",
      tampered.length === 0,
      tampered.length ? tampered.map(([p]) => p).join(", ") : `${frozen.length} archivo(s) intactos`,
    );
  } else {
    report.skip("criterios de aceptacion sin modificar", "el paquete no declara archivos congelados");
  }

  // Guion largo y guion medio: regla explicita del dueño del repositorio.
  const added = git(["diff", "--unified=0", baseSha, head])
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  const dashes = added.filter((l) => /[–—]/.test(l));
  report.add(
    "sin em dash ni en dash",
    dashes.length === 0,
    dashes.length ? `${dashes.length} linea(s): ${dashes[0].slice(0, 80)}` : "limpio",
  );

  // Nada publicado sin revision. Se relaja con allowPublished cuando el flujo
  // acordado es publicar la rama a proposito para que el CI la juzgue: ese CI
  // es un oraculo mas fuerte que este verificador, no una fuga.
  if (pkg.allowPublished) {
    report.skip("rama no publicada", "allowPublished: se publica para que el CI emita el veredicto");
  } else {
    const remote = gitOk(["rev-parse", "--verify", `refs/remotes/origin/${branch}`]);
    report.add("rama no publicada", !remote, remote ? "existe en origin" : "solo local");
  }

  // Conteo de aserciones pgTAP: se parsea de los archivos, no se le cree a nadie.
  const planTotal = (ref) => {
    const files = git(["ls-tree", "-r", "--name-only", ref, "--", "supabase/tests"])
      .split("\n")
      .filter(Boolean);
    return files.reduce((sum, f) => {
      const m = /select\s+plan\(\s*(\d+)\s*\)/i.exec(git(["show", `${ref}:${f}`]));
      return sum + (m ? Number(m[1]) : 0);
    }, 0);
  };
  if (pkg.expectPgtapDeltaMin > 0) {
    const before = planTotal(baseSha);
    const after = planTotal(head);
    report.add(
      "aserciones pgTAP aumentaron",
      after - before >= pkg.expectPgtapDeltaMin,
      `${before} -> ${after} (delta ${after - before}, minimo exigido ${pkg.expectPgtapDeltaMin})`,
    );
  } else {
    report.skip("aserciones pgTAP aumentaron", "el paquete no exige pruebas de base de datos");
  }

  return { head, baseSha };
}

function behavioralChecks(pkg, report, head, opts) {
  const scratch = join(REPO, ".verify-worktrees", pkg.id);
  rmSync(scratch, { recursive: true, force: true });
  gitOk(["worktree", "prune"]);

  try {
    // Worktree limpio y aislado: nada del directorio de trabajo del agente
    // puede influir en el resultado.
    git(["worktree", "add", "--detach", scratch, head]);

    const envLocal = join(REPO, ".env.local");
    if (existsSync(envLocal)) {
      writeFileSync(join(scratch, ".env.local"), readFileSync(envLocal));
    }

    // En Windows, Node 24 rechaza ejecutar npm.cmd directamente (endurecimiento
    // por CVE-2024-27980). Hay que pasar por el interprete de comandos.
    const isWin = process.platform === "win32";
    const runNpm = (name, args) => {
      const bin = isWin ? process.env.COMSPEC || "cmd.exe" : "npm";
      const argv = isWin ? ["/d", "/s", "/c", "npm", ...args] : args;
      try {
        execFileSync(bin, argv, {
          cwd: scratch,
          stdio: "pipe",
          encoding: "utf8",
          maxBuffer: 128 * 1024 * 1024,
        });
        return report.add(name, true, "exit 0");
      } catch (error) {
        // status null significa que el proceso ni arranco: es un fallo del
        // verificador, no del codigo bajo prueba. Hay que distinguirlos.
        const salida = `${error.stdout ?? ""}\n${error.stderr ?? ""}`.trim();
        const detalle =
          error.status === null || error.status === undefined
            ? `EL VERIFICADOR NO PUDO EJECUTAR EL COMANDO: ${error.code ?? ""} ${error.message}`
            : `exit ${error.status}\n${salida.split("\n").slice(-15).join("\n")}`;
        return report.add(name, false, detalle);
      }
    };

    if (!runNpm("npm ci", ["ci", "--no-audit", "--no-fund"])) return;
    if (!runNpm("npm run preflight", ["run", "preflight"])) return;
    if (opts.withDb) runNpm("npm run test:db", ["run", "test:db"]);
    else report.skip("npm run test:db", "no se pidio --with-db");
  } catch (error) {
    report.add("worktree aislado", false, String(error.message ?? error));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
    gitOk(["worktree", "prune"]);
  }
}

// --- ejecucion ----------------------------------------------------------

function verify(pkg, opts) {
  const report = new Report(pkg);
  const refs = structuralChecks(pkg, report);

  if (!refs) {
    // Sin rama no hay nada que juzgar.
  } else if (opts.full) {
    behavioralChecks(pkg, report, refs.head, opts);
  } else {
    report.skip("npm ci", "no se pidio --full");
    report.skip("npm run preflight", "no se pidio --full");
    report.skip("npm run test:db", "no se pidio --full");
  }

  const result = {
    id: pkg.id,
    name: pkg.name,
    branch: pkg.branch,
    commit: refs?.head ?? null,
    base: refs?.baseSha ?? null,
    verdict: report.verdict,
    mode: opts.full ? (opts.withDb ? "full+db" : "full") : "estructural",
    checks: report.checks,
  };

  mkdirSync(RESULTS, { recursive: true });
  writeFileSync(join(RESULTS, `${pkg.id}.json`), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function print(result) {
  const mark = { PASS: "PASS", FAIL: "FAIL", SKIP: "----" };
  console.log(`\n${result.id}  ${result.name}`);
  console.log(`  rama ${result.branch}  commit ${result.commit?.slice(0, 7) ?? "?"}`);
  for (const c of result.checks) {
    console.log(`  [${mark[c.status]}] ${c.name}`);
    if (c.status === "FAIL") {
      for (const line of String(c.detail).split("\n")) console.log(`         ${line}`);
    } else if (c.status === "PASS" && c.detail) {
      console.log(`         ${c.detail}`);
    }
  }
  console.log(`  VEREDICTO: ${result.verdict}  (modo ${result.mode})`);
}

function main() {
  const argv = process.argv.slice(2);
  const opts = { full: argv.includes("--full"), withDb: argv.includes("--with-db") };
  const positional = argv.filter((a) => !a.startsWith("--"));

  if (!existsSync(MANIFEST)) {
    console.error(`No existe el manifiesto ${MANIFEST}`);
    process.exit(2);
  }
  const packages = JSON.parse(readFileSync(MANIFEST, "utf8")).packages;
  const selected = argv.includes("--all")
    ? packages
    : packages.filter((p) => positional.includes(p.id) || positional.includes(p.branch));

  if (!selected.length) {
    console.error("Nada seleccionado. Usa --all o pasa un id de paquete.");
    process.exit(2);
  }

  const results = selected.map((pkg) => {
    const r = verify(pkg, opts);
    print(r);
    return r;
  });

  const failed = results.filter((r) => r.verdict === "FAIL");
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${results.length - failed.length}/${results.length} paquetes en verde`);
  for (const r of failed) {
    const names = r.checks.filter((c) => c.status === "FAIL").map((c) => c.name);
    console.log(`  FALLA ${r.id}: ${names.join(", ")}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main();
