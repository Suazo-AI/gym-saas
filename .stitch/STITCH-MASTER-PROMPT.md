# FitManager — Google Stitch master context and prompt sequence

## How to use

1. Create a **web application** project in Google Stitch.
2. Add/import `.stitch/DESIGN.md` as the project design system when Stitch offers that option.
3. Paste **Master project context** once at the start of the Stitch project.
4. Send prompts 1–7 **one at a time and in order**. Do not combine them into one giant generation request.
5. Refine one screen or component per follow-up, preserving the same project and design system.

Google’s Stitch guidance recommends starting complex apps at a high level, then iterating screen by screen with specific changes. This sequence follows that approach.

---

# Master project context — paste this first

You are designing **FitManager**, a responsive multi-tenant web SaaS for small gyms in Nicaragua, typically 25–100 members. Produce high-fidelity product UI and connected prototype screens, not marketing concepts and not backend code.

All customer-facing UI copy must use **simple, natural Spanish** suitable for gym owners, managers, and receptionists in Nicaragua. Keep labels direct and operational. Never expose database, RLS, RPC, DTO, API, tenant-ID, or implementation terminology to end users.

## Design source of truth

Use the supplied `DESIGN.md` as the visual authority for every screen. If it is unavailable, use this exact fallback summary:

- Fixed light color scheme; there is no dark-mode toggle.
- Page/content background: paper `#F9F9F9`.
- Dominant dark surface and text: ink `#000000`.
- Dark secondary surface: charcoal `#333333`.
- Primary action/brand orange: `#E85002`, normally with ink text.
- Primary hover/deep accent: `#C10801`, with paper text when required.
- Supporting amber: `#F16001`; sand: `#D9C3AB`.
- Muted text: `#646464` on light surfaces and `#A7A7A7` on dark surfaces.
- Light borders: `#CCCCCC`; subtle surface/divider: `#E5E5E5`.
- Success and error use the semantic emerald/red sets defined in `DESIGN.md`; status meaning must never depend only on color.
- Use the existing system sans stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif`.
- Typography is direct and heavy: operational titles often use weight 900; body text uses 14–16px; uppercase tracked labels are reserved for compact hierarchy.
- Base spacing rhythm: 4px. Common gaps: 8, 12, 16, 20, 24, 32px.
- Controls: minimum 44px height, usually 6px radius.
- Cards/panels/dialogs: usually 8px radius with thin borders; pills only for statuses.
- Hierarchy comes from typography, spacing, borders, and ink/paper contrast before shadows.
- Orange is for the primary action and active emphasis, not for every status.
- Motion is functional and restrained: short color/focus feedback, no decorative movement.
- Avoid glassmorphism, neon dark dashboards, excessive gradients, huge radii, generic icon-card grids, decorative fitness imagery, hover movement, and fake visual complexity.
- Do not introduce a new font, color palette, icon language, or theme.

Important conflict rule: older FitManager drafts mentioned a dark “Vortex” system with Space Grotesk/Space Mono. That direction is stale. Ignore it. The supplied current `DESIGN.md` and the paper/ink/orange system above win.

## Product purpose and MVP

FitManager should make the daily gym operation fast, understandable, and auditable. The core vertical workflow is:

`buscar o registrar miembro → asignar membresía → revisar cargo → registrar pago → emitir recibo → consultar estado → registrar entrada`

The interface must always make these contexts clear before a sensitive action:

- current member;
- active gym;
- active branch;
- current user role/capabilities;
- amount and currency;
- membership state;
- payment/charge state;
- observed access or entry result.

Do not write unsupported claims such as guaranteed revenue growth, retention improvement, or time saved. This is an operational tool, not a Dribbble demo.

## User roles

### Recepcionista

Design for fast daily work:

- search, view, and register members;
- assign an existing plan and initial membership when authorized;
- review generated charges;
- record payments when authorized;
- view member status and register entry when a safe contract exists;
- use optional operational facial verification where available;
- resolve only the alerts/actions permitted to reception.

The receptionist must not create or change plan prices, administer permissions, edit exchange rates, manage SaaS billing, or directly administer biometric retention/security records.

### Gerente

May manage operational members, memberships, payments, entries, alerts, receptionists, and reports within approved permissions. Do not imply owner-only powers: plan-price changes, exchange-rate changes, ownership changes, SaaS billing, gym archive, unrestricted exports, critical security settings, or permission-model changes.

### Dueño

Has full tenant-level control, but sensitive actions still require confirmation, reason, audit expectations, and reauthentication where applicable. Financial history is never physically deleted.

### Administrador de plataforma

Internal FitManager SaaS operator. Keep this shell clearly separate from each gym’s tenant interface. Platform subscriptions, invoices, and payments are SaaS billing; they must never be confused with member memberships, charges, and payments.

## Security and backend behavior the UI must respect

- Supabase Auth, PostgreSQL, RLS, views, RPCs, trusted server routes, and Edge Functions are the backend/security boundary.
- The browser never decides `gym_id`, permissions, prices, totals, payment state, currency conversion, membership validity, or access decisions.
- Hiding a button is not authorization. Include explicit unauthorized and unavailable states while assuming server/RLS enforcement.
- Every commercial record belongs to one gym. Never imply cross-gym visibility.
- One authorized gym may auto-select. Multiple authorized gyms require an explicit gym selector. Branch access is limited to authorized branches belonging to the active gym.
- Keep active gym and branch visible on desktop and mobile.
- Money must be shown as server-provided decimal values. Never calculate critical totals in the UI.
- Keep NIO and USD separate. Never merge or convert currencies unless a future approved stored-rate contract exists.
- Never delete payments, charges, subscriptions, entries, income, or audit history. Use lifecycle concepts such as cancel, void, correct, or refund only when approved and audited.
- Administrative soft deletion requires a trusted operation, confirmation, reason, and audit trail.
- Facial recognition is optional, requires consent where applicable, and cannot be the only entry method or irreversible evidence.

## Contract-status vocabulary

Use these labels only in Stitch screen names, annotations, or handoff notes—not as technical copy inside the customer UI:

- `IMPLEMENTED`: behavior exists in the current product.
- `CONTRACT-BACKED`: backend/data contract exists but UI may be incomplete.
- `PROPOSAL`: UX/route proposal awaiting integration approval.
- `BLOCKED`: product/security/backend decision is unresolved; design may illustrate structure but must not pretend the operation is production-ready.

Current important statuses:

- Authentication/session: partially implemented.
- Member list/detail/create: implemented or contract-backed.
- Member update and administrative soft-delete/restore services: contract-backed; complete UI unfinished.
- Plan/subscription data: exists; lifecycle/start/renewal rules are incomplete.
- Membership charge generation: contract-backed through a server RPC.
- Standalone atomic payment/allocation: blocked.
- Partial payment, correction, void/refund rules: blocked or incomplete.
- Receipt number/PDF/print contract: blocked.
- Member operational/access-status data: partial; do not invent a final access decision.
- Manual/QR entry and duplicate-entry/override rules: blocked.
- Facial verification event flow: implemented/partial and optional.
- Dashboard and income sources: partial; only verified metrics may be treated as real.
- Staff/settings: partial.
- Alerts and tenant audit: intended MVP surfaces but incomplete.
- Platform-admin routes: implemented or partial; support remains contract-dependent.

### UI-relevant contract map

Use these names only in Stitch annotations/handoff notes, never as customer-facing copy:

- Member list: `public.api_v1_member_summaries`.
- Member detail: `public.api_v1_member_details`.
- Member creation: `public.create_gym_member(...)`.
- Member update: `public.update_gym_member(...)`.
- Administrative removal/restoration: trusted soft-delete/restore functions; never direct physical deletion.
- Private member media: `gym-media` Storage plus `media_assets` / `person_photos`; UI must account for upload, MIME/size failure, permission failure, and private access.
- Plans and subscriptions: `membership_plans` → `member_subscriptions`; lifecycle rules remain incomplete.
- Charge generation: `generate_membership_charges` RPC; amount/totals come from the server.
- Payments: `member_payments` plus `member_payment_allocations`; a safe standalone atomic public payment/allocation RPC is still blocked.
- Observed member status: `v_member_access_status`; currently incomplete for a final access decision.
- Owner overview: `v_gym_dashboard` plus approved income/access views; definitions remain partial.
- Facial entry flow: current server API/RPC and facial-recognition events; manual/QR entry contract is still blocked.
- Alerts/audit: schema support exists broadly, but complete receptionist-facing contracts/routes are unfinished.

Contract names establish traceability only. They do not authorize Stitch to invent fields, actions, metrics, totals, or outcomes not described in this context.

For blocked flows, create annotated evaluation screens if requested, but do not invent totals, allocations, conversion, cancellation outcomes, denial reasons, overrides, or backend success. Place uncertainty in design annotations, not confusing developer language in the customer interface.

## Product information architecture

### Public/authentication

- `/` — marketing, not the priority of this design project.
- `/login`
- `/forgot-password`
- `/reset-password`
- `/auth/callback` — backend flow, not a normal destination screen.

Required auth/system states:

- loading;
- invalid credentials;
- recovery instructions sent;
- invalid or expired recovery link;
- expired session;
- invited/pending account;
- suspended account;
- revoked account;
- no valid gym/branch context;
- unauthorized;
- safe not-found.

### Proposed tenant shell

Use these routes as design metadata/proposals; do not display URLs to customers:

- `/app` — role-based redirect.
- `/app/reception`
- `/app/members`
- `/app/members/new`
- `/app/members/[memberId]`
- `/app/members/[memberId]/membership`
- `/app/members/[memberId]/charge`
- `/app/members/[memberId]/payment`
- `/app/members/[memberId]/receipt/[paymentId]`
- `/app/members/[memberId]/entry`
- `/app/memberships/plans`
- `/app/memberships/subscriptions`
- `/app/charges`
- `/app/payments`
- `/app/entries`
- `/app/alerts`
- `/app/overview`
- `/app/income`
- `/app/reports`
- `/app/staff`
- `/app/roles`
- `/app/settings/gym`
- `/app/settings/branches`
- `/app/settings/billing`

Tenant navigation labels in simple Spanish:

- Recepción
- Resumen
- Miembros
- Membresías
- Pagos
- Entradas
- Alertas
- Ingresos / Reportes
- Personal
- Configuración

Filter navigation by role/capability. Authorization remains server-side.

### Separate platform shell

- `/platform`
- `/platform/gyms`
- `/platform/gyms/[gymId]`
- `/platform/subscriptions`
- `/platform/invoices`
- `/platform/payments`
- `/platform/support` — only as proposal while contract is incomplete.
- `/platform/audit`

Platform navigation labels:

- Resumen
- Gimnasios
- Suscripciones SaaS
- Facturas SaaS
- Pagos SaaS
- Soporte
- Auditoría

## Required screen inventory

### P0 — core

1. Login.
2. Forgot/reset password and recovery-result states.
3. Session expired, pending, suspended, revoked, unauthorized, and unavailable-context screens.
4. Tenant AppShell desktop/tablet/mobile.
5. Reception home: member search, initial guidance, loading, no result, multiple matches, selected member, permission error, network retry.
6. Register member: identity/contact, duplicate detection, optional details/photo, recoverable validation, success.
7. Assign membership: member summary, existing plan selection, start date, server-derived review; annotate unresolved lifecycle rules.
8. Charge review: member, plan, amount, currency, status, confirmation and failure states.
9. Payment review: outstanding charges, explicit currency/method/amount, review confirmation, submission lock, pending/error; mark atomic/partial rules blocked.
10. Receipt success: confirmed result, identifier/print/download placeholders only where contract exists; mark receipt contract blocked.
11. Member detail/status: identity, branch, current membership, charges by original currency, payment summary limitations, contacts, notes, human-readable observed status.
12. Entry: permitted/denied/manual-review/no-match/duplicate proposal and safe retry; never make facial recognition mandatory.

### P1 — tenant MVP follow-up

13. Members list and filters; dense table on desktop, intentional cards/list on mobile.
14. Membership plans.
15. Subscriptions and charges.
16. Payments history and financial lifecycle states.
17. Entries history.
18. Alerts operational queue.
19. Owner/manager overview.
20. Income and reports with separate NIO/USD treatment.
21. Staff: invited, active, suspended, revoked.
22. Roles and effective permissions.
23. Gym settings.
24. Branches and branch availability.
25. Tenant SaaS billing context.
26. Tenant audit history.

### P1 — separate platform administration

27. Platform overview.
28. Gyms list.
29. Gym detail/support context.
30. SaaS subscriptions.
31. SaaS invoices.
32. SaaS payments.
33. Platform support proposal.
34. Platform audit.

### Explicitly out of scope

Do not add:

- classes, schedules, or reservations;
- workouts/routines;
- nutrition/diet plans;
- trainer portal;
- prospect CRM/funnels;
- point of sale or inventory;
- payroll or full accounting;
- member self-service portal;
- native mobile app;
- automatic doors;
- large-chain features;
- a facial-recognition-first product architecture.

## AppShell and responsive behavior

Design the same interaction model across widths:

### Desktop — 1440px target

- Persistent 292px ink sidebar.
- Brand, role-allowed navigation, context card, account, and sign-out.
- Persistent top/context area showing active gym and branch.
- Paper content canvas with dense but readable operational layout.
- One dominant primary action per screen.
- Optional contextual right rail only when it helps the current job.

### Tablet — 768px target

- Compact/collapsible navigation proposal.
- Gym and branch remain visible.
- Reduce table columns intentionally; keep actions labelled.

### Mobile — 390px target; verify 320px

- Compact top bar with active gym/branch and account/menu access.
- A proposed text-led bottom navigation with at most: Recepción, Miembros, Alertas, Más; no unexplained icon-only actions.
- Lists become designed cards rather than squeezed desktop tables.
- Sticky bottom CTA only for the current dominant action, with content padding so nothing is covered.
- No document-level horizontal overflow.

Any new mobile navigation not present in the current product must be annotated as `PROPOSAL` in the handoff.

## Core reception interaction model

Reception home should prioritize member search by name, phone, or member code. Search results should make the following scannable where data exists:

- member identity/photo or initials;
- member code;
- phone;
- branch;
- current plan;
- expiry;
- pending amounts separated by currency;
- observed membership/access status;
- one clear next action.

Selected-member command area:

- Vigente / observed valid state → show the safe entry action only if contract/permission allows it.
- En mora → show `Cobrar saldo` only if payment capability exists.
- Vencida → show `Renovar membresía` as a blocked/proposed lifecycle action where unresolved.
- Bloqueada/inactiva → explain the human-readable observed reason and only show authorized recovery actions.
- No membership → show `Asignar membresía` when authorized.

Do not invent “access allowed” from incomplete membership data. Distinguish identity, membership, charge/payment, and entry/access states.

## Money and high-risk interaction patterns

Every financial review screen must repeat:

- gym and branch;
- member;
- action type;
- amount;
- currency;
- payment method where applicable;
- affected charge(s) where known;
- server-returned result;
- remaining balance only when contract-backed.

Lock repeated submission during processing. Include loading, pending, retry-safe error, duplicate/idempotent outcome, unauthorized, and final confirmation states. Do not offer physical deletion. Sensitive correction/void/cancel actions require reason and audit expectations when approved.

## Global states and accessibility

Every feature must account for relevant:

- initial/loading skeleton;
- empty/no results;
- validation;
- duplicate;
- success;
- warning;
- recoverable network/server error;
- stale data;
- unauthorized;
- wrong-tenant safe not-found;
- session expired;
- no gym/branch context;
- destructive/financial review confirmation;
- disabled and processing state.

Accessibility requirements:

- visible focus on every control;
- keyboard-complete navigation;
- minimum 44×44px targets;
- persistent form labels and inline errors;
- status conveyed with text and shape/icon only if consistent with the supplied design system, never color alone;
- logical headings and landmarks;
- dialog focus entry, containment, Escape, close, and focus return;
- reduced-motion behavior;
- no horizontal document scroll at 320px;
- Spanish labels must fit without clipping;
- critical actions should be labelled, not icon-only.

## Content and mock-data rules

- Use realistic fictional names/records only to demonstrate layout.
- Never present sample data as live data.
- Do not invent unsupported features, business metrics, growth percentages, targets, claims, exchange conversions, permission codes, financial outcomes, or access decisions.
- Dashboard cards/charts may appear only when their definition and source are considered contract-backed. Otherwise use an annotated empty/blocked frame instead of fake analytics.
- Keep NIO and USD in separate cards, rows, totals, and chart series.
- Use direct Spanish labels such as `Nuevo miembro`, `Crear miembro`, `Buscar`, `Ver detalle`, `Cancelar`, `Intentar de nuevo`, `Gimnasio activo`, `Miembro no encontrado`, `Acceso permitido`, `Acceso denegado`, `Revisión manual`, and `Sin coincidencia` where applicable.

## Required output behavior

- Keep all generated screens inside one coherent FitManager web project.
- Reuse the same components and exact visual tokens across every phase.
- Name each screen with phase, role, feature, state, and contract status, for example: `[P0][Recepción][Búsqueda—sin resultados][CONTRACT-BACKED]`.
- Create desktop and mobile variants from one interaction model.
- For each generated screen, provide concise notes containing: primary user/job, route, dominant action, state, contract status, unresolved assumption, and responsive behavior.
- Do not silently redesign previously approved screens when adding later screens.
- Do not generate all 34 screens in one pass. Complete the phased prompts below in order.

Acknowledge this context briefly. Then wait for Prompt 1 before generating screens.

---

# Prompt 1 — foundations and tenant AppShell

Using the FitManager master context and supplied `DESIGN.md`, establish the reusable project foundation and generate the tenant AppShell first.

Create:

1. Desktop AppShell at 1440px with 292px ink sidebar, active gym/branch context, role/capability-aware text navigation, account/sign-out, paper content canvas, and one sample `Recepción` module header.
2. Tablet AppShell at 768px with compact navigation and persistent gym/branch context.
3. Mobile AppShell at 390px plus a 320px narrow check, using the proposed text-led navigation pattern and no page overflow.
4. Shared UI foundations visible in context: primary/secondary/destructive buttons, inputs, select, cards, status panel, dense row, mobile record card, loading skeleton, empty state, inline notice, confirmation dialog, and unauthorized state.

Use only the current paper/ink/orange design system. Do not use the stale Vortex dark theme, Space Grotesk, Space Mono, glassmorphism, generic fitness imagery, or invented icons.

Annotate new responsive navigation as `PROPOSAL`. Do not generate dashboard analytics yet. Return concise design notes and wait for approval before Prompt 2.

---

# Prompt 2 — authentication and system states

Preserve the approved FitManager foundation. Generate desktop and mobile variants for:

- login;
- forgot-password request;
- recovery instructions sent;
- reset password;
- invalid/expired recovery link;
- session expired;
- invited/pending account;
- suspended account;
- revoked account;
- unauthorized;
- no valid gym/branch context;
- safe not-found.

Use simple Spanish. Keep forms focused, labels persistent, errors recoverable, focus visible, and intended-destination recovery clear. Do not expose Supabase/RLS/API terminology. Reuse the existing split authentication layout on desktop and the single-column form on mobile. Wait for approval before Prompt 3.

---

# Prompt 3 — reception search and member management

Preserve all approved foundations. Generate a connected receptionist flow in desktop 1440px and mobile 390px:

1. Reception initial/search state.
2. Search loading.
3. No results with `Nuevo miembro` action.
4. Multiple possible matches.
5. Selected member with observed status and one safe next action.
6. Member registration identity/contact step.
7. Duplicate-member warning with `Ver detalle` for an existing record.
8. Optional details/photo step.
9. Validation/network recovery with entered data preserved.
10. Member-created success with `Asignar membresía` when authorized.
11. Member detail with identity, branch, current membership, pending charges separated by currency, payment-summary limitations, contacts, and notes.

Optimize for speed at reception. Desktop may use dense rows; mobile must use intentional cards. Never infer final access permission from incomplete data. Wait for approval before Prompt 4.

---

# Prompt 4 — membership, charge, payment, and receipt prototype

Preserve the member and gym/branch context through every screen. Generate annotated evaluation screens for:

1. Existing-plan selection and membership start review.
2. Membership lifecycle blocked state.
3. Server-derived charge review.
4. Charge loading/failure.
5. Outstanding charges grouped by original currency.
6. Full-payment review with amount, currency, method, affected charge, confirmation, and submission lock.
7. Payment pending/retry-safe error.
8. Payment success.
9. Receipt success/print/download structure.
10. Correction/void/cancel confirmation structure with reason and audit expectation.

Mark unresolved membership lifecycle, standalone atomic payment/allocation, partial payment, correction/void/refund, exchange rate, and receipt-document behavior as `BLOCKED`. Do not invent calculations, conversion, allocation, receipt identifiers, or successful backend outcomes. Keep NIO and USD separate. Wait for approval before Prompt 5.

---

# Prompt 5 — member status, entries, biometrics, and alerts

Preserve the approved system. Generate desktop and mobile variants for:

- member observed states: vigente, en mora, vencida, bloqueada/inactiva, and no membership;
- entry result states: permitted, denied, duplicate warning, manual review, network retry;
- recent entries list;
- facial verification dialog: camera ready, permission denied, no camera, verifying, timeout, no match, uncertain/multiple candidates, denied, success, close/cancel, retry;
- alerts queue: empty, open, resolved, retry.

Manual/QR entry, duplicate window, override, denial rules, and active-branch resolution remain `BLOCKED` or `PROPOSAL`. Facial recognition is optional and cannot be the only entry method. Design complete dialog keyboard/focus behavior. Wait for approval before Prompt 6.

---

# Prompt 6 — owner/manager intelligence and tenant administration

Preserve all approved components. Generate desktop and mobile variants for:

- owner/manager overview;
- income by date/branch/currency;
- reports and drill-down structure;
- membership plans;
- subscriptions/charges;
- payments history;
- staff statuses and management;
- effective roles/permissions;
- gym settings;
- branches;
- tenant SaaS billing context;
- tenant audit history.

Only use metrics considered contract-backed. No fake growth percentages, decorative goals, loyalty/satisfaction metrics, currency conversion, full accounting, profit, tax, or payroll. Keep USD/NIO separate. Charts require labelled axes, units, period, legend, accessible text/table alternative, empty/loading/error/stale states, and meaningful drill-down. Sensitive owner-only actions need confirmation/reason/audit expectations. Wait for approval before Prompt 7.

---

# Prompt 7 — separate platform administration and consistency pass

Create a clearly separate platform-admin shell and desktop/mobile screens for:

- platform overview;
- gyms list;
- gym detail/support context;
- SaaS subscriptions;
- SaaS invoices;
- SaaS payments;
- support proposal;
- platform audit.

Do not reuse tenant active-gym assumptions. Clearly distinguish SaaS billing from member billing. Avoid raw IDs as the main human label. Include loading, empty, error, unauthorized, and not-found states.

Then perform a project-wide consistency review without redesigning approved work:

- exact DESIGN.md token consistency;
- shared component consistency;
- role/capability navigation consistency;
- tenant/platform separation;
- member/SaaS financial separation;
- contract-status annotations;
- Spanish copy consistency;
- desktop/tablet/mobile continuity;
- 320px overflow risk;
- focus, contrast, status, and dialog accessibility;
- removal of unsupported features, fake metrics, generic AI-dashboard patterns, and stale Vortex styling.

Return a concise screen inventory showing generated, pending, proposal, and blocked items.