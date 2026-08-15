import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = process.argv[2];
const OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });

const base = readFileSync(SRC, "utf8");

const EDGE = '<div aria-hidden="true" class="w-[6px] bg-action-green shrink-0"></div>';
const AVATAR = '<div aria-hidden="true" class="w-16 h-16 rounded-full bg-lime/20 text-action-green flex items-center justify-center text-headline-lg font-bold border border-lime/30">';
const VERDICT_RE = /<!-- Verdict Content -->[\s\S]*?<\/button>\n<\/div>/;

function assertOnce(html, needle, label) {
  const n = html.split(needle).length - 1;
  if (n !== 1) throw new Error(`anchor "${label}" matched ${n} times, expected 1`);
}

assertOnce(base, EDGE, "leading edge");
assertOnce(base, AVATAR, "rail avatar");
if (!VERDICT_RE.test(base)) throw new Error('anchor "verdict block" did not match');

const PRIMARY_BTN = (icon, label) =>
  `<button class="w-full h-[52px] bg-action-green text-white rounded-[10px] text-body-lg font-body-md font-medium hover:bg-opacity-90 transition-colors shadow-sm flex items-center justify-center gap-2 active:scale-[0.98]">
<span aria-hidden="true" class="material-symbols-outlined text-[24px]">${icon}</span>
${label}
</button>`;

const EYEBROW = (color, icon, text) =>
  `<div class="flex items-center gap-2 mb-2">
<span aria-hidden="true" class="material-symbols-outlined text-[22px] ${color}">${icon}</span>
<span class="text-label-sm font-label-sm font-mono uppercase tracking-widest ${color} font-semibold">${text}</span>
</div>`;

const GRACE_VERDICT = `<!-- Verdict Content -->
<div aria-atomic="true" aria-live="polite" class="mb-8" role="status">
${EYEBROW("text-[#B45309]", "error", "Entrada permitida")}
<h3 class="text-[28px] font-semibold text-charcoal-ink mb-2">En gracia</h3>
<p class="text-body-lg font-body-lg text-operational-gray">Renovación pendiente dentro del período de gracia.</p>
</div>
<!-- Actions -->
<div class="space-y-3">
${PRIMARY_BTN("how_to_reg", "Registrar entrada")}
<p class="text-body-md font-body-md text-operational-gray text-center">Recuérdale renovar su membresía.</p>
</div>`;

const DENIED_VERDICT = `<!-- Verdict Content -->
<div aria-atomic="true" aria-live="polite" class="mb-8" role="status">
${EYEBROW("text-[#B91C1C]", "block", "Morosa")}
<h3 class="text-[28px] font-semibold text-charcoal-ink mb-2">Acceso bloqueado</h3>
<p class="text-body-lg font-body-lg text-operational-gray">Tiene cargos vencidos fuera del período de gracia.</p>
</div>
<!-- Actions -->
<div class="space-y-3">
${PRIMARY_BTN("payments", "Registrar pago")}
<details class="group rounded-[10px] border border-quiet-border bg-warm-paper overflow-hidden">
<summary class="px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
<span class="min-h-[20px] flex items-center justify-between gap-2 text-body-md font-body-md font-medium text-charcoal-ink">
<span class="flex items-center gap-2">
<span aria-hidden="true" class="material-symbols-outlined text-[20px] text-operational-gray">lock_open</span>
Permitir con motivo
</span>
<span aria-hidden="true" class="material-symbols-outlined text-[20px] text-operational-gray transition-transform group-open:rotate-180">expand_more</span>
</span>
</summary>
<div class="px-4 pb-4 pt-3 border-t border-quiet-border bg-pure-surface">
<label class="block text-label-md font-label-md font-mono text-operational-gray mb-2" for="override-reason">Motivo para permitir la entrada</label>
<textarea class="w-full min-h-[88px] rounded-[10px] border-quiet-border bg-warm-paper text-body-md font-body-md text-charcoal-ink focus:border-lime focus:ring-2 focus:ring-lime transition-all" id="override-reason" maxlength="500" placeholder="Explica por qué se autoriza esta entrada" required=""></textarea>
<p class="mt-2 text-label-md font-label-md font-mono text-operational-gray">Se guarda con tu nombre y la hora.</p>
<button class="mt-3 w-full min-h-[48px] rounded-[10px] border border-[#B91C1C] bg-pure-surface text-[#B91C1C] text-body-md font-body-md font-medium hover:bg-[#B91C1C]/5 transition-colors">
Permitir entrada y registrar motivo
</button>
</div>
</details>
</div>`;

const VARIANTS = [
  {
    file: "grace.html",
    title: "Recepción rápida - En gracia - FitManager",
    edge: "#D97706",
    avatar: "bg-[#D97706]/10 text-[#B45309] border-[#D97706]/30",
    verdict: GRACE_VERDICT,
  },
  {
    file: "denied.html",
    title: "Recepción rápida - Acceso bloqueado - FitManager",
    edge: "#DC2626",
    avatar: "bg-[#DC2626]/10 text-[#B91C1C] border-[#DC2626]/30",
    verdict: DENIED_VERDICT,
  },
];

for (const v of VARIANTS) {
  let html = base;
  html = html.replace(
    "<title>Recepción rápida - FitManager</title>",
    `<title>${v.title}</title>`,
  );
  html = html.replace(
    EDGE,
    `<div aria-hidden="true" class="w-[6px] bg-[${v.edge}] shrink-0"></div>`,
  );
  html = html.replace(
    AVATAR,
    `<div aria-hidden="true" class="w-16 h-16 rounded-full ${v.avatar} flex items-center justify-center text-headline-lg font-bold border">`,
  );
  html = html.replace(VERDICT_RE, v.verdict);
  writeFileSync(`${OUT}/${v.file}`, html, "utf8");
  console.log(`wrote ${OUT}/${v.file} (${html.length} bytes)`);
}
