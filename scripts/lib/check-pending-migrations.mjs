import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const IS_WIN = process.platform === "win32";

function run(command, args, repo) {
  try {
    return {
      ok: true,
      out: execFileSync(command, args, {
        cwd: repo,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
      err: "",
    };
  } catch (error) {
    return {
      ok: false,
      out: error.stdout ?? "",
      err: error.stderr ?? String(error),
    };
  }
}

function supabaseCommand(repo) {
  const base = join(repo, "node_modules", ".bin");
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

export function parseMigrationListOutput(output) {
  const pending = [];
  let total = 0;
  let parsed = false;

  for (const line of output.split("\n")) {
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

  return { parsed, pending, total };
}

export function checkPendingMigrations({ repo }) {
  const cli = supabaseCommand(repo);
  if (!cli) {
    return {
      status: "warn",
      detail: "no se encontro el CLI de supabase en node_modules/.bin. Correr npm ci.",
    };
  }

  const listed = run(cli.bin, [...cli.prefix, "migration", "list", "--local"], repo);
  const output = `${listed.out}${listed.err}`;
  const { parsed, pending, total } = parseMigrationListOutput(output);

  if (!parsed) {
    const reason = /Failed to connect|LegacyDbConnectError/.test(output)
      ? "el stack local no responde. Levantarlo con:  npx supabase start"
      : "no se pudo leer la lista de migraciones del CLI";
    return { status: "warn", detail: `${reason}. Sin veredicto.` };
  }

  if (pending.length === 0) {
    return {
      status: "pass",
      detail: `${total} migraciones versionadas, ninguna pendiente`,
    };
  }

  return {
    status: "fail",
    detail:
      `${pending.length} de ${total} migracion(es) versionadas que la base local no aplico: ${pending.sort().join(", ")}.\n` +
      "  Aplicar con:  npx supabase migration up  (o  npx supabase db reset  si podes perder los datos locales)",
  };
}
