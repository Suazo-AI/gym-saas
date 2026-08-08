#!/usr/bin/env node
// install-hooks - instala los disparadores de verificacion en git.
//
// Reemplaza al watcher por polling: en vez de preguntar cada 90 segundos si
// algo cambio, git avisa en el momento exacto en que cambia. Los hooks viven
// en un solo lugar del repositorio y se disparan desde CUALQUIER worktree,
// asi que cubren tambien lo que commitea un agente delegado en otro directorio.
//
//   post-commit  verifica el paquete de la rama actual y anota el veredicto.
//                Nunca falla el commit: solo observa y deja rastro.
//   pre-push     BLOQUEA el push si el veredicto del paquete es FAIL.
//                Ese si muerde. Se saltea con --no-verify si hace falta.
//
// Uso:  node scripts/install-hooks.mjs

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// git rev-parse --git-common-dir apunta al .git real y no al del worktree,
// que es justamente donde viven los hooks compartidos.
const commonDir = resolve(
  REPO,
  execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: REPO,
    encoding: "utf8",
  }).trim(),
);
const hooksDir = join(commonDir, "hooks");

const POST_COMMIT = `#!/bin/sh
# Instalado por scripts/install-hooks.mjs. No editar a mano.
# Observa y anota. Nunca falla el commit.
node "${REPO.replace(/\\/g, "/")}/scripts/verify-on-branch.mjs" post-commit 2>/dev/null || true
exit 0
`;

const PRE_PUSH = `#!/bin/sh
# Instalado por scripts/install-hooks.mjs. No editar a mano.
# Bloquea el push si el paquete de la rama tiene veredicto FAIL.
# Para saltarlo a proposito: git push --no-verify
node "${REPO.replace(/\\/g, "/")}/scripts/verify-on-branch.mjs" pre-push
`;

mkdirSync(hooksDir, { recursive: true });
for (const [name, body] of [["post-commit", POST_COMMIT], ["pre-push", PRE_PUSH]]) {
  const path = join(hooksDir, name);
  writeFileSync(path, body, "utf8");
  try {
    chmodSync(path, 0o755);
  } catch {
    // En Windows el bit de ejecucion no aplica y git usa el shell igual.
  }
  console.log(`instalado ${path}`);
}

console.log(`
Hooks activos para todos los worktrees de este repositorio.
post-commit anota en verification/watch.log. pre-push bloquea si el veredicto es FAIL.`);
