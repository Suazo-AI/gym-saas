# FitManager — UX/UI + repo audit

Audit date: 2026-07-21 (CAST)
Repo: https://github.com/Suazo-AI/gym-saas
Local clone: `C:\Users\Jason\gym-saas`

## Executive decision

Do **not** prioritize another landing-page redesign or more dashboard polish.

Highest-value frontend priority:

1. Lock navigation, roles, active gym/branch context, and data contracts.
2. Prototype the complete **reception workflow**: find/register member → assign membership → charge/pay → receipt → status → check-in.
3. Test that workflow with receptionists.
4. Only then build the owner dashboard and secondary modules.

Current `/admin` is a polished moodboard, not a usable product. Preserve its warm green/cream brand direction, but treat its implementation as disposable prototype code.

Official priority caveat: repo rules say live Trello controls priority and assignments (`AGENTS.md:2-35`, `970-986`). Repo only contains `Docs/trello-board-template.md`, explicitly not current state. No Trello URL/card was provided. Recommendations below are evidence-based, but cannot be labeled official board priority until reconciled with live Trello.

---

## 1. Product understood

### Product

Multi-tenant SaaS for Nicaraguan gyms with roughly 25–100 members. It replaces paper, spreadsheets, and WhatsApp for daily operations.

### Primary users

- Receptionist: high-frequency member lookup, registration, payment, status, and entry.
- Owner: overdue balances, expiring memberships, income, entries, staff, alerts.
- Manager: intended role, but its exact permission model is unresolved/inconsistent.
- SaaS platform admin: separate internal product surface; should not share the tenant gym shell.

### MVP core

- Gyms and branches
- Auth, users, roles, permissions
- Members and photos
- Plans and memberships
- Charges, payments, allocations, receipts, delinquency
- USD and NIO
- Entries
- Alerts
- Owner dashboard and basic income/reporting
- Audit and soft deletion
- Strict cross-gym isolation

Explicitly outside first flow: native mobile app, workouts, nutrition, trainer portal, payroll, full accounting, advanced inventory, automatic door control, and facial recognition as a dependency (`README.md:22-50`; `AGENTS.md:69-109`).

### Critical business flow

`README.md:344-357` defines the vertical slice:

1. Create/select gym.
2. Register member.
3. Assign plan.
4. Generate charge.
5. Register/apply payment.
6. Check membership status.
7. Register entry.
8. Prove a second gym cannot access the data.

This flow—not a generic analytics dashboard—is the product.

### Two billing domains

Keep separate in labels and IA:

- Gym’s SaaS subscription/invoices/payments.
- Member’s membership/charges/payments.

Schema and `AGENTS.md:397-432` distinguish them. A generic “Pagos” label can become ambiguous for owners/platform admins.

---

## 2. Repository reality

Inspected all 34 tracked files: source, config, docs, three migrations, generated DB types, lockfile/dependency graph, images through the rendered app, Git history/PRs, issues, and CI state.

| Area | Current reality | Evidence |
|---|---|---|
| Marketing | One polished static landing page | `src/app/page.tsx`, `page.module.css` |
| Product UI | One static `/admin` dashboard with fake data | `src/app/admin/page.tsx:4-64` |
| Functional routes | `/`, `/admin`, built-in not-found only | real `next build` output |
| Interactions | Seven sidebar/config links use `href="#"`; buttons do nothing | `admin/page.tsx:18-23`, `30`, `51-61` |
| Data | No page imports or queries Supabase | all app source inspected |
| Auth | SSR/browser clients and cookie refresh exist; login/protected routes do not | `src/lib/supabase/*`, `proxy.ts` |
| Database | Broad 47-table final schema, 4 views, 12 public RPCs | migrations + decoded `database.types.ts` |
| Tests | None | tracked file inventory/package scripts |
| CI | No GitHub Actions runs/workflows | `gh run list` returned `[]` |
| Issues | No GitHub issues | `gh issue list` returned `[]` |
| Lint | Fails because generated type file is UTF-16 and ESLint treats it as binary | real `npm run lint` |
| Build | Passes; both pages statically prerender | real `npm run build` |
| Security audit | 2 moderate production findings through `next -> postcss@8.4.31` | real `npm audit --omit=dev` |

Approximate implementation balance:

- UI/layout source: 378 lines.
- Supabase Next client/proxy source: 96 lines.
- SQL migrations: 4,683 lines.
- Generated DB types: 3,152 lines, UTF-16.

This is a database-heavy foundation with a visual demo—not an integrated SaaS yet.

### Repo health mismatches

1. `database.types.ts` is UTF-16. Build accepts it; ESLint fails at line 1: `Parsing error: File appears to be binary`.
2. Docs require Tailwind and Zod, but neither is installed; app uses CSS Modules (`package.json:11-25`). Decide one styling strategy before multiplying screens.
3. README tells users to copy `.env.example`, but no `.env.example` is tracked (`README.md:168-179`).
4. Supabase config enables `./seed.sql`, but file is missing (`supabase/config.toml:66-71`).
5. Global local Storage limit is 50 MiB while migration-created `gym-media` bucket uses 10 MiB (`supabase/config.toml:115-124`; storage migration around lines 117-136). Document which limit controls member uploads.
6. GitHub repo is PUBLIC, but README says the project is private/no reuse permission (`README.md:429-431`). Resolve legal/visibility mismatch.
7. No automated test/typecheck script or CI gate.
8. Audit found Next `16.2.10` pulling vulnerable `postcss@8.4.31`; registry showed Next/eslint-config-next `16.2.11` available. Do not run the audit’s destructive/incorrect-looking forced downgrade suggestion blindly.

---

## 3. Functional/data map relevant to frontend

### Member creation

`persons` + `person_contacts`/`person_addresses` → `gym_members` → optional `media_assets` + `person_photos`.

UX implication: member identity and tenant membership are separate records. Duplicate detection must consider person/contact and gym membership, not only a name field.

### Membership

`membership_plans` → `member_subscriptions` → `membership_charges`.

Useful statuses already exist:

- Member: prospect, active, inactive, suspended, blocked, archived.
- Subscription: trialing, active, past_due, paused, canceled, expired.
- Charge: pending, partial, paid, overdue, void.

Do not collapse these into one vague “Activo/Vencido” badge. Show the operational state and the next action.

### Payments

`member_payments` → `member_payment_allocations` → charge status refresh triggers.

Blocker: there is no public atomic RPC to register and allocate a member payment. Public RPCs cover charge generation and cancellation, but not the full payment/receipt flow. `AGENTS.md` requires sensitive money operations to be atomic and not browser-trusted. Frontend may prototype this screen, but production integration needs a Full-Stack contract first.

### Member status/access

Final `v_member_access_status` supplies:

- member code and identity
- member status
- active-subscription boolean
- overdue-charge boolean
- access-allowed boolean

It does **not** supply plan name, expiration date, balance amount, currency, last entry, or a human-readable denial reason. The planned check-in and member-status screens need a documented view/RPC extension or composed server contract.

### Entries

Critical gap: no generic check-in/attendance/access-event table or `register_entry` RPC exists. Current access events are `face_recognition_events`; dashboard “successful accesses today” counts allowed facial events. Facial recognition is explicitly after the basic MVP flow.

Result: the manual entry UX can be prototyped, but its production contract is unresolved. Do not silently encode manual check-ins as facial events without a product/schema decision.

### Dashboard

Final `v_gym_dashboard` exposes:

- active members
- overdue charge count
- current-month income in gym default currency
- successful facial accesses today
- open alerts

Current UI instead shows active members, entries, revenue growth, “por vencer,” a six-month chart, and recent activity. Several displayed metrics have no current view contract:

- “Por vencer” is not returned.
- Month-over-month percentage is not returned.
- Six-month revenue series is not returned by this view.
- “Actividad reciente” has no unified source.
- Entries depend on facial events.
- Mixed USD/NIO totals need the unresolved exchange-rate rule.

Do not wire fake UI labels to semantically different DB fields.

### Roles/navigation mismatch

Docs define Owner, Manager, Receptionist, Platform Admin. `private.bootstrap_new_gym` currently creates Owner, Administrator, Receptionist, Accountant, and Trainer (`initial_schema.sql` around line 1100). Accountant/trainer are not initial MVP roles; Manager/platform admin semantics do not match.

Seeded screens are English and include facial access/SaaS billing/audit, but omit a normal Entries screen and Reports screen (`initial_schema.sql:932-989`). Current `/admin` nav differs again.

Role matrix + screen map must be approved before implementing permission-aware navigation.

---

## 4. Current UX/UI audit

### What is worth keeping

- Warm forest green + cream + terracotta feels human, local, and more distinctive than neon “fitness tech.”
- Landing hierarchy and Spanish copy are clear.
- Marketing and dashboard share a coherent visual family.
- Compact radius/elevation posture suits an operations product.
- Production build serves all tested widths without document-level horizontal overflow.
- Images have useful alt text.
- Marketing motion already respects `prefers-reduced-motion`.

### Product blockers

1. **No real workflow.** Every product action is static/fake.
2. **Mobile loses navigation.** At 390 and 320 px, sidebar nav and gym context disappear; no menu replacement exists.
3. **Active tenant context disappears on mobile.** In a multi-tenant app this is a wrong-gym action risk, not cosmetic polish.
4. **Dashboard-first IA.** Receptionist’s high-frequency search/payment/check-in work is secondary to a revenue chart.
5. **No state design.** Missing loading, empty, duplicate, validation, permission denied, session expired, offline/retry, success, void/refund, destructive confirmation, and partial-payment states.
6. **No role-specific defaults.** Receptionist and owner should not land on identical dashboards.
7. **Current `/admin` label is ambiguous.** Gym owner/manager product and internal platform admin need separate shells.

### Accessibility/browser findings

Real production Playwright + axe-core pass over six cases: `/` and `/admin` at 1440, 390, and 320 px.

Passed:

- HTTP 200 in every case.
- No production console errors.
- No page errors.
- No failed requests.
- No document horizontal overflow.

Failed/weak:

- Serious `color-contrast` violation on every case.
- Operational UI uses many 7–10 px labels; audit found 65 sub-12px leaf text nodes on admin desktop and 48 on mobile.
- 14 visible admin controls on desktop and 7 on mobile had at least one dimension below 44 px.
- Seven desktop nav/config links are hash no-ops.
- Mobile has zero visible sidebar nav links and zero menu controls.
- Mobile member rows hide plan and renewal date, leaving member + status + unlabeled `•••`; grid placement is not an intentional mobile card design.
- `•••` row buttons have no accessible names.
- Unicode glyphs are being used as product icons; semantics and visual consistency are weak.
- No explicit `:focus-visible` system exists.

Representative axe failures include muted 8 px labels with contrast around 2.74–3.61:1, below 4.5:1.

### Landing-page assessment

Landing is visually ahead of the product. Keep it mostly stable for now.

Later fixes:

- Remove or qualify unvalidated proof/claims until 10 owner/manager interviews exist.
- Replace fake-avatar “proof” with real pilot evidence when available.
- Add a real pilot/demo/contact conversion path—not only “open static admin.”
- Fix tiny preview text/contrast.
- Avoid adding Aura/Lafys-style animated gradients/WebGL before core product works.

---

## 5. Priority plan

## Gate 0 — Reconcile live Trello and product decisions

Before production coding, obtain the real cards/status and close these blockers:

- Membership lifecycle: renewal, grace, pause/freeze, cancellation, reactivation, plan changes.
- Complete/partial payment and correction rules.
- USD/NIO rate ownership, effective date, and receipt display.
- Entry method: manual search, QR, or both.
- Manual entry table/RPC and denial-reason contract.
- Initial role/permission matrix.
- Member self-access decision.

Frontend may prototype assumptions, but every assumption must be labeled and reviewed.

## P0 Design — Navigation map + role/tenant shell

First concrete UX artifact.

Acceptance:

- Separate tenant app from platform-admin app.
- Active gym and branch always visible, including mobile.
- Owner, manager, receptionist navigation variants map to permission codes.
- Real routes replace `href="#"`.
- Responsive sidebar/drawer/bottom-nav behavior defined.
- Unauthorized pages/actions have explicit states; hiding a button is not authorization.
- Terminology is Spanish and consistent.

## P0 Design — Reception vertical-flow prototype

Design one connected flow, not isolated pretty screens:

1. Search by name, phone, or member code.
2. Register member with duplicate warning.
3. Pick plan/start date.
4. Review generated charge.
5. Record payment in NIO or USD.
6. Confirm rate/partial-payment behavior only if approved.
7. Produce receipt.
8. Show current membership/access state.
9. Register entry or show denial reason.

Include normal, loading, empty, error, permission, duplicate, partial, overdue, blocked, success, and retry states.

## P0 Frontend foundation — Thin design system, not a component-library project

Before multiplying pages:

- Convert generated DB types to UTF-8 so lint works.
- Decide CSS Modules vs Tailwind; docs and code currently disagree.
- Define semantic tokens: background, surface, text, muted, border, primary, success, warning, danger, focus.
- Set minimum practical app typography: ~14 px body; ~12 px metadata; eliminate 7–10 px operational labels.
- Use a consistent icon set and accessible labels.
- Define buttons, inputs, search, status badges, table/list, drawer, dialog, toast, skeleton, empty/error states.
- Add clear `focus-visible`; target roughly 44 px touch controls.
- Add lint + typecheck + test scripts and CI.

Keep implementation lean. Build primitives only when the vertical slice needs them.

## P0 Implementation — Auth + active gym context

Production code order:

1. Login/recovery/session-expired screens.
2. Protected app shell.
3. Invite/suspended/revoked states.
4. Active gym/branch selection.
5. Permission-aware navigation.

This is required before trustworthy tenant data integration.

## P0 Implementation — Vertical slice

Implement in business dependency order:

1. Member registration.
2. Plan/membership assignment.
3. Charge generation.
4. Payment/allocation/receipt after atomic contract exists.
5. Member status.
6. Entry after entry contract exists.
7. Two-gym isolation tests.

## P1 — Member operations

- Member list with search/filter/status.
- Member detail: identity, membership, balance/ledger, entries, files/photo, alerts.
- Edit + soft delete/restore with confirmations and permissions.
- Responsive list becomes intentionally designed cards, not hidden columns.

## P1 — Owner dashboard

Build only from defined metrics. Prioritize action queues:

- Overdue balances/members.
- Expiring memberships.
- Open alerts.
- Entries today.
- Income by currency.
- Recent operational activity if a real source exists.

Make each card lead to the relevant filtered list. Defer decorative six-month charts until the contract and owner research justify them.

## P2 — Staff/settings/reports + marketing polish

After vertical flow works:

- Staff/role management.
- Income and essential reports.
- Gym/branch/settings.
- Landing conversion/proof/SEO polish.
- Optional theme/motion work.

Do not work now: trainer portal, workout tracking, classes/scheduling, door control, full biometric UI, native app, advanced accounting/inventory.

---

## 6. Recommended product IA

Exact routes must be aligned with seeded `screens`, but recommended mental model:

### Tenant app

- **Recepción** — default for receptionist; universal search, member state, payment, check-in.
- **Miembros** — list, details, history, create/edit.
- **Membresías** — plans/subscriptions/charges.
- **Cobros** — member payments, receipts, corrections.
- **Entradas** — live/recent entries and denied attempts.
- **Ingresos y reportes** — owner/authorized roles.
- **Alertas** — actionable queue.
- **Personal** — users, roles, effective permissions.
- **Configuración** — gym, branches, currency, future rate.

### Platform admin

Separate `/platform/...` shell for SaaS plans, tenant subscription/billing, support, and audited platform access.

### Persistent context

Header/shell should always show:

- active gym
- active branch, if applicable
- current role/context
- session/account menu

Money and destructive confirmations should repeat relevant gym/member/currency context.

---

## 7. Core screen UX

### Reception workspace

Primary job: complete lookup/payment/check-in with minimal navigation.

- Large keyboard-first search.
- Result card: photo, member code, phone, plan, expiration, balance, access state, last entry.
- State-specific primary CTA:
  - allowed → `Registrar entrada`
  - overdue → `Cobrar saldo`
  - expired → `Renovar membresía`
  - blocked → show reason; privileged override only if approved/audited.
- Recent entries/alerts below, not a revenue chart.

### Register member

- Identity + phone first.
- Duplicate check before long data entry.
- Optional fields and photo progressively disclosed.
- Membership can follow in same guided flow, but member record success must be clear.
- Preserve entered values after recoverable errors.

### Payment/receipt

- Member context and outstanding charges visible.
- NIO/USD selected explicitly.
- Applied rate shown when conversion is approved.
- Server-provided totals; no critical browser calculation.
- Method, amount, allocations, remaining balance.
- Review/confirm step for money.
- Success receipt with unique number, print/download path, and correction policy.

### Entry

- One dominant action.
- Large, redundant text + icon state: Permitida / Vencida / Morosa / Bloqueada.
- Show concise reason and approved next action.
- Accidental duplicate-entry protection.
- Manual review/override needs permission and audit.

### Owner dashboard

Primary job: know what needs attention now.

- Actionable risk/queue cards before trends.
- NIO and USD kept separate until approved conversion rules exist.
- Metric definitions/tooltips and links to source lists.
- No invented percentage changes.

---

## 8. Visual direction

Design read: small-gym staff with mixed technical comfort; dependable operational SaaS; risk is turning an editorial demo into a tiny-text generic dashboard; direction is **warm operational clarity**.

Taste dials:

- Novelty: 2/5
- Density: 3/5 desktop, 2/5 mobile
- Warmth: 4/5
- Brand force: 3/5
- Motion: 1/3

Concrete direction:

- Keep forest green/cream/terracotta as brand seed.
- Use sans-serif for operational copy/data; reserve serif for marketing or rare brand moments.
- Use typography/spacing before card proliferation.
- Moderate 6–8 px radii; avoid pill-everything/glassmorphism.
- Status never relies on color alone.
- Subtle 120–180 ms state feedback; no cinematic app transitions.
- Real operational content beats gym lifestyle decoration inside the product.

---

## 9. External inspiration research

Live pages were opened in Edge/Playwright and captured. References are pattern inputs, not templates to copy.

### Dribbble — Zenith Gym customer management

Reference: https://dribbble.com/shots/26176459-Designing-a-Better-Customer-Management-Experience-for-Zenith-Gym

- Pattern: sidebar, member/customer table enriched with contact, membership status, activity history, search/filter, nearby row actions.
- Why: supports staff scanning and acting without opening every profile.
- Adaptation: FitManager member rows should expose status, expiration, balance, last entry, then `Cobrar`, `Entrada`, or labeled overflow action.
- Risk: too many inline actions and desktop-only density.
- Implementation hint: desktop data table + intentionally separate mobile member cards; stable filters and labeled menus.

### Dribbble — Gym admin overview

Reference: https://dribbble.com/shots/26159899-Gym-Admin-Dashboard-Manage-Members-Trainers-Revenue

- Pattern: memberships, revenue, activity, and an inactive-member engagement widget.
- Why: turns overview into retention action.
- Adaptation: replace generic engagement with overdue/expiring member queues backed by real FitManager definitions.
- Risk: vanity KPIs/soft gradients without actionable sources.
- Implementation hint: each KPI links to a filtered operational list.

### Dribbble — Members list / Box Command CRM

Reference: https://dribbble.com/shots/4357174-Members-List

- Pattern: dedicated member-list surface inside a gym CRM.
- Adaptation: use list as the operational hub, not merely a dashboard footer.
- Risk: copying old visual styling or assuming CRM fields absent from schema.

### Pinterest — GetFit admin template

Reference: https://www.pinterest.com/pin/296604325480602421/

- Pattern: compact fitness-admin visual grouping.
- Adaptation: use only density/hierarchy inspiration for desktop overview.
- Risk: generic Bootstrap-template dashboard, too many charts, workout analytics outside FitManager’s admin problem.

Pinterest search returned public images but also a signed-out overlay. No protected/private pin content was assumed.

### Mobbin

Reference: https://mobbin.com/

Targeted gym search redirected to logged-out homepage. Public page emphasizes searchable **screens, UI elements, and complete flows**, including onboarding, login, subscriptions/paywalls, search, filtering, dialogs, and account setup.

- Pattern: research whole flows/states, not isolated hero shots.
- Adaptation: when access is available, benchmark login/invite, onboarding, search/filter, payment confirmation, receipt, and destructive-dialog flows.
- Risk: claiming inaccessible screenshots or importing consumer-mobile patterns into a desktop reception tool.

### Aura components

Reference: https://www.aura.build/components

- Pattern: filterable component catalog with reusable HTML/CSS/Tailwind sections.
- Adaptation: mine form, table, drawer, dialog, empty-state, and button anatomy only after license/code/accessibility review.
- Risk: current popular catalog is hero/gradient/animation-heavy; wrong priority for product UI. Repo also does not currently install Tailwind.

### Lafys page 2 / dynamic theme

References:

- https://lafys.com/?page=2
- https://lafys.com/posts/dynamic-theme-switching

- Pattern: high-impact landing composition and theme transition.
- Adaptation: optional later marketing interaction; keep one restrained brand moment.
- Risk: dark/light animation and WebGL distract from reception speed, accessibility, and MVP completion.

### Real gym SaaS benchmarks

- Gymdesk: https://gymdesk.com/ — “without the learning curve,” organized around memberships, billing, attendance, reporting.
- PushPress: https://www.pushpress.com/ — member journey, management, data-driven decision making.
- GymMaster: https://www.gymmaster.com/ — member management, billing, access; door/access-control scope should not leak into FitManager MVP.
- TeamUp: https://goteamup.com/ — useful product-in-context screenshots, but booking/classes are outside current FitManager scope.

Best transferable principle: **a receptionist should complete the core workflow without training**. This aligns with FitManager’s own Trello usability criterion.

---

## 10. Verification evidence

Commands/results:

- `npm ci` — completed; 360 packages installed.
- `npm run build` — passed; `/` and `/admin` static.
- `npm run lint` — failed only on UTF-16 generated DB type being parsed as binary.
- `npm audit --omit=dev` — 2 moderate findings; no high/critical findings.
- Production browser QA — six route/viewport cases, HTTP 200, no overflow, no console/page/network failures; serious contrast issue in all six.
- Git status remained clean; no repo files modified by this audit.

Raw artifacts:

- `C:\Users\Jason\AppData\Local\Temp\gym-saas-audit\local-audit.json`
- `C:\Users\Jason\AppData\Local\Temp\gym-saas-audit\research-sources.json`
- `C:\Users\Jason\AppData\Local\Temp\gym-saas-audit\reference-details.json`
- Screenshots in `C:\Users\Jason\AppData\Local\Temp\gym-saas-audit\`:
  - `home-desktop.png`, `home-mobile.png`, `home-narrow.png`
  - `admin-desktop.png`, `admin-mobile.png`, `admin-narrow.png`
  - `research-*.png`, `detail-*.png`

## Recommended next card

If live Trello confirms it:

**“Crear mapa de navegación y prototipo de recepción end-to-end”**

Deliverables:

1. Role-based sitemap and tenant/platform shell split.
2. Desktop + mobile wireframes.
3. Connected register → membership → payment → receipt → status → entry prototype.
4. State matrix.
5. Data/permission contract checklist beside each screen.
6. Usability test with two receptionists, followed by prioritized corrections.

That gives the team a validated frontend target before backend contracts and production screens multiply.
