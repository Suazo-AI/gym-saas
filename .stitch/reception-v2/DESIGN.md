# Design System: FitManager Reception Decision Surface v2

## Scope and precedence

This reference applies to the FitManager Reception screen and its desktop-first Stitch prototype.
It supports the Trello card `Probar prototipo con usuarios`.
Current repository contracts and approved August 2026 product specifications override older orange-theme Stitch documents.
This is a visual and interaction reference, not authorization to change money, membership, entry, privacy, or permission rules.

## 1. Product job and audience

The primary user is a receptionist working quickly during a busy gym shift.
The screen has one job: find the correct member, understand the server-provided access decision, and take the next permitted action without changing pages unnecessarily.
The experience should feel trustworthy, calm, and fast for staff with mixed technical comfort.
Use concise, natural Spanish from Nicaragua throughout the interface.

### Success test

A new receptionist can search, select the correct member, explain the access verdict, and register an allowed entry without instruction.
The active gym and branch remain visible throughout the task.
The screen does not expose unnecessary personal or financial information.

## 2. Reference stack and adapted patterns

- [PushPress check-ins](https://help.pushpress.com/en/articles/508409-core-members-check-ins) informs the tight sequence from member identification to eligibility and resolution.
- [PushPress Staff App](https://www.pushpress.com/feature-list/staff-app) informs keeping member context beside the operational action instead of sending staff through multiple screens.
- [Wodify barcode sign-in](https://help.wodify.com/hc/en-us/articles/39584752736919-Setting-Up-Barcode-Sign-In) informs a distraction-free check-in surface and the removal of sensitive staff-only information.
- [Glofox access and check-in](https://www.glofox.com/features/access-control-check-in/) informs the connection between current membership state, access outcome, and a visible event log.
- [Mobbin](https://mobbin.com/), [Nicelydone search flows](https://nicelydone.club/flows/search), and [SaaSFrame](https://www.saasframe.io/) inform polished list-detail composition and complete operational flows.
- [WAI-ARIA combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) informs arrow-key navigation, Enter selection, Escape dismissal, focus handling, and selected-option semantics.
- [Shopify search field](https://shopify.dev/docs/api/app-home/web-components/forms/search-field) and [Primer Autocomplete](https://primer.style/product/components/autocomplete/guidelines/) inform immediate search feedback, loading, no-result treatment, and rich full-row options.
- [Material 3 canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview) and [Apple split views](https://developer.apple.com/design/human-interface-guidelines/split-views) inform desktop list-detail behavior and sequential mobile navigation.

Dribbble, Behance, and Awwwards may inform mood only.
They do not determine operational behavior.

## 3. Visual theme and atmosphere

Use warm operational clarity with density 6 of 10, visual variance 3 of 10, and motion 2 of 10.
The interface should resemble a dependable front-desk instrument, not a fitness marketing page or a generic analytics dashboard.
Use clear zones, strong reading order, compact headings, and generous control sizes.
The one memorable feature is the Access Verdict Rail, a decisive selected-member panel that communicates outcome, reason, and next action at a glance.
Everything around that rail remains quiet and disciplined.

## 4. Color palette and roles

- **Deep Forest** (`#111814`) is the persistent sidebar and strongest structural surface.
- **Charcoal Ink** (`#18201B`) is primary text and dark secondary structure.
- **Warm Paper** (`#F3F7F4`) is the application canvas.
- **Pure Surface** (`#FFFFFF`) is the search, result, selected-member, and history surface.
- **Operational Gray** (`#46544B`) is secondary text that must retain accessible contrast.
- **Quiet Border** (`#D5DED8`) separates fields, rows, and panels.
- **Action Green** (`#15803D`) is the only action accent for the active navigation item, primary button, links, and selected state.
- **Lime Signal** (`#84CC16`) is limited to the brand mark and visible keyboard focus.
- **Warning Amber** (`#D97706`) communicates grace or payment attention with text and an icon.
- **Danger Red** (`#DC2626`) communicates blocked access or errors with text and an icon.

Do not use pure black, neon green surfaces, purple, blue glow, gradients, glass effects, or decorative color.
Status must never depend on color alone.

## 5. Typography rules

Use the exact CSS family name `Geist` for headings, controls, and body copy, followed by `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks.
Use Geist Mono only for member codes, timestamps, and compact operational metadata.
Use 28px to 32px for the page title, 20px to 24px for section titles, 16px for important body copy, and 14px for metadata.
Do not use text smaller than 12px.
Use weight 600 or 700 for hierarchy and avoid excessive weight 900 across every label.
Use sentence case for Spanish interface copy.
Do not use serif fonts, Inter, oversized display typography, or decorative tracking.

## 6. Desktop layout

Target a 1440px desktop viewport.
Use a fixed 248px Deep Forest sidebar and a flexible Warm Paper workspace.
Keep the active gym, branch, role, and account context visible in the sidebar.
Use a compact page header with `Entradas`, `Recepción rápida`, one explanatory sentence, and the secondary `Verificar con cámara` action.

### Workspace composition

1. Place one large search field at the top of the working area.
2. Below search, use an asymmetric 7-to-5 list-detail split.
3. The left side contains full-row selectable search results separated by dividers.
4. The right side contains the Access Verdict Rail for the selected member.
5. Fill the lower workspace with recent entry events rather than leaving dead space or adding dashboard metrics.

### Search result row

Display only the member name, member code, and a labelled selection affordance.
The search may match a phone number, but the row must not display that phone number.
Do not display email, plan, expiry date, balance, amount due, charge details, or internal notes.
Make the entire row selectable while retaining an explicit accessible label such as `Seleccionar a Ana Martínez`.
Show a strong selected state with border, background, and text, not color alone.

### Access Verdict Rail

Start with member identity using name and member code only.
Present one large verdict that states the outcome, not the internal state name.
The allowed outcomes are `Acceso permitido` and `En gracia`; every denied outcome uses `Acceso bloqueado`.
Above the verdict, show a small monospace eyebrow with the state name exactly as `src/features/entries/entry-decision-state.ts` produces it: `Permitida`, `En gracia`, `Pago pendiente`, `Sin membresía`, `Vencida`, `Morosa`, or `Bloqueada`.
The eyebrow keeps the rail consistent with the entry-history chips, which use those same labels.
Place one concise human-readable reason beneath the verdict.
Use a 6px semantic leading edge, a restrained tinted background, an icon, and explicit text.
Do not display amounts, dates, contact details, notes, or technical policy language.
For an allowed result, show one dominant `Registrar entrada` button.
For grace, show `Registrar entrada` and a short renewal reminder without an amount.
For a denied result, do not show an ordinary entry button.
When the current user is allowed to override, place `Permitir con motivo` as a clearly secondary, guarded action that requires a written reason.

### Recent entries

Use a dense divided list with source, decision label, timestamp, and concise decision reason.
Do not invent member names or other fields absent from the current entry-history contract.
Keep filters compact and secondary to the reception task.
Use visible labels instead of icon-only controls.

## 7. Component styling

- Primary buttons use Action Green, white text, 10px radius, and at least 44px height.
- Secondary buttons use Pure Surface, Quiet Border, Charcoal Ink, and at least 44px height.
- Search uses a persistent visible label, 52px field height, search icon, clear control, and Lime Signal focus outline.
- Result lists use one shared surface with row dividers rather than individual floating cards.
- Cards appear only for selected-member context or a meaningful state boundary.
- Status treatments combine icon, label, reason, border, and tint.
- Loading uses skeletons matching the search rows and verdict rail.
- Errors appear next to the affected task and state what happened plus the next safe action.
- Success confirmation uses the same vocabulary as the initiating action.

Use simple line icons only where they improve scanning.
Do not use emojis or icon-only critical actions.

## 8. Responsive behavior

At widths below 768px, replace the sidebar with a compact top bar and labelled navigation drawer.
Keep active gym and branch context visible.
Show search and results first.
Open the selected member as a sequential detail view with a labelled Back action instead of squeezing list and detail side by side.
Keep the dominant action reachable without covering content.
Maintain 44px minimum touch targets and no document-level horizontal overflow at 390px or 320px.

## 9. Required interaction states

- Initial guidance before a search.
- Search loading.
- No results.
- Multiple matches.
- Selected member with access permitted.
- Selected member in grace.
- Initial payment required.
- Overdue and blocked.
- No membership or expired membership.
- Entry submission in progress.
- Entry registered successfully.
- Duplicate entry warning.
- Recoverable network or server error.
- Unauthorized override.
- Session or gym-context failure.

The prototype screen should show the selected permitted state while preserving visual patterns for the other states.

## 10. Accessibility and privacy contract

Search follows the WAI-ARIA combobox keyboard model when suggestions appear.
Arrow keys move through results, Enter selects, and Escape dismisses the result popup without clearing the field.
Announce result counts and entry confirmations with appropriate status messaging.
Move focus to the selected-member heading after an explicit selection when that helps the workflow.
Use visible focus on every interactive element.
Respect reduced motion.
Do not use color as the only status signal.
The browser does not calculate or decide access.
The interface presents the server-provided decision.
Never expose cross-gym data, phone numbers in results, financial amounts, due dates, charge details, private notes, or biometric details on this screen.

## 11. Motion and feedback

Use 120ms to 180ms opacity and transform transitions for focus, selection, and button press feedback.
Do not animate layout dimensions or use perpetual motion.
Do not use page-load choreography, floating panels, shimmer outside loading skeletons, or cinematic transitions.

## 12. Banned patterns

- No KPI strip, revenue chart, or decorative dashboard cards.
- No three-equal-card row.
- No glassmorphism, gradient text, outer glow, or neon dashboard treatment.
- No giant headings or excessive empty space.
- No duplicated actions with equal visual weight.
- No generic labels such as `Submit`, `Continue`, or `Action`.
- No fake metrics, percentages, balances, dates, or operational claims.
- No sensitive member details on search results or the verdict rail.
- No facial recognition presented as mandatory or infallible.
- No workouts, nutrition, scheduling, inventory, trainer portal, or other out-of-scope modules.

## 13. Estado del prototipo por estado

Los artefactos aprobados y en revisión viven en `.stitch/reception-v2/states/`.

- `_base-v2.html` es el export literal de la pantalla Stitch `a2a03cd0b3524e3ead7062fa15f4b3ab`, ya aprobada, y no se edita a mano.
- `build-states.mjs` deriva las variantes desde esa base con anclas exactas y falla si un ancla aparece más o menos de una vez.
- `grace.html` es el estado permitido con renovación pendiente dentro del período de gracia.
- `denied.html` es el estado bloqueado por cargos vencidos fuera del período de gracia.

Regenerar con:

```
node .stitch/reception-v2/states/build-states.mjs .stitch/reception-v2/states/_base-v2.html .stitch/reception-v2/states
```

### Contrato de origen

El texto de cada veredicto viene del servidor, no del navegador.
`register_member_entry` en `supabase/migrations/20260810200000_overdue_access_policy.sql` es quien decide y quien escribe el motivo.
La gracia es `decision = allowed` con `financial_access_status = grace`, así que la entrada sí se registra.
La morosidad fuera de gracia es `decision = denied`, y el único camino de entrada es `p_override_reason`, que además escribe un registro `entry.override` en `audit_logs`.

### Ajustes de color aplicados

Warning Amber `#D97706` y Danger Red `#DC2626` se usan tal cual en el borde semántico de 6px, que no lleva texto.
El texto y el icono del eyebrow usan `#B45309` y `#B91C1C`, porque los tonos base sobre superficie blanca no alcanzan 4.5 a 1 en 11px.
El color nunca es la única señal: el eyebrow siempre trae icono y texto.

### Decisiones abiertas

- En `denied.html`, la acción dominante es `Registrar pago`, que hoy no existe como enlace en la pantalla de entradas. Necesita aprobación antes de implementarse.
- `entry-decision-state.ts` marca `Morosa` con tono `warning`, el mismo tono que `En gracia`. Un estado permitido y uno bloqueado comparten color. El prototipo usa rojo para lo bloqueado y ámbar para la gracia, y propone cambiar ese tono en el código.
- Hoy cualquier usuario con `entries.manage` puede usar el override. Falta decidir si eso debe exigir un permiso propio.

### Brecha conocida

Ninguna de las dos variantes cumple todavía la sección 8.
Debajo de 768px la barra lateral sigue fija en 248px y el contenido queda empujado fuera de la ventana.
La base v2 ya venía así; se corrige en una variante responsive aparte, no en estas dos.
