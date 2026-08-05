# Member Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar, retirar y restaurar miembros desde superficies seguras del gimnasio activo.

**Architecture:** Se reutilizan las RPC existentes `update_gym_member`, `soft_delete_entity`, `restore_entity` y `list_deleted_entities`. Server Actions derivan `gym_id` con `getActiveGym`; componentes cliente muestran formularios y estados, mientras PostgreSQL conserva la autorización real.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Zod, Supabase/PostgreSQL, Vitest y pgTAP.

---

### Task 1: Validación y acciones seguras

**Files:**
- Modify: `src/features/members/schemas/member.schema.ts`
- Modify: `src/features/members/schemas/member.schema.test.ts`
- Modify: `src/features/members/actions/member.actions.ts`
- Create: `src/features/members/actions/member.actions.test.ts`

- [ ] Escribir pruebas que exijan UUID, motivo mínimo y que ignoren `gymId` enviado por formulario.
- [ ] Ejecutar `npm test -- src/features/members/schemas/member.schema.test.ts src/features/members/actions/member.actions.test.ts` y confirmar fallo por contrato ausente.
- [ ] Implementar `retireMemberSchema`, `restoreMemberSchema` y Actions que usan `getActiveGym`, revalidan `/members`, `/members/[id]` y `/dashboard`, y devuelven `{ ok, message }`.
- [ ] Repetir el comando y confirmar PASS.

### Task 2: Repositorio, permiso y papelera

**Files:**
- Modify: `src/features/members/types/member.dto.ts`
- Modify: `src/features/members/services/member.repository.ts`
- Create: `src/features/members/services/member.repository.test.ts`

- [ ] Escribir pruebas para `canManageMembers`, `listDeletedMembers`, retiro y restauración con los nombres exactos de RPC.
- [ ] Ejecutar `npm test -- src/features/members/services/member.repository.test.ts` y confirmar fallo por funciones ausentes.
- [ ] Implementar `DeletedMemberDto`, consulta de permiso efectivo y mapeo de `list_deleted_entities` limitado al gimnasio activo.
- [ ] Repetir el comando y confirmar PASS.

### Task 3: Edición y retiro desde detalle

**Files:**
- Modify: `src/app/members/[gymMemberId]/page.tsx`
- Modify: `src/features/members/components/member-detail-view.tsx`
- Create: `src/features/members/components/member-administration.tsx`
- Create: `src/features/members/components/member-administration.test.tsx`

- [ ] Escribir prueba que renderice “Editar miembro”, “Guardar cambios” y una confirmación con motivo para “Retirar miembro”, y que los oculte sin permiso.
- [ ] Ejecutar `npm test -- src/features/members/components/member-administration.test.tsx` y confirmar fallo por componente ausente.
- [ ] Implementar formulario con nombre, apellido, código, sucursal, teléfono y correo; añadir sección de peligro con explicación de conservación histórica.
- [ ] Repetir el comando y confirmar PASS.

### Task 4: Papelera de miembros

**Files:**
- Create: `src/app/members/deleted/page.tsx`
- Create: `src/app/members/deleted/loading.tsx`
- Create: `src/features/members/components/deleted-members.tsx`
- Create: `src/features/members/components/deleted-members.test.tsx`
- Modify: `src/app/members/page.tsx`

- [ ] Escribir prueba para fecha, motivo, restauración, vacío, error y ocultación sin permiso.
- [ ] Ejecutar `npm test -- src/features/members/components/deleted-members.test.tsx` y confirmar fallo por componente ausente.
- [ ] Implementar página protegida y enlace “Papelera” visible únicamente con `members.manage`.
- [ ] Repetir el comando y confirmar PASS.

### Task 5: Verificación

**Files:**
- Modify: `docs/superpowers/plans/2026-08-04-member-administration.md`

- [ ] Ejecutar `npm test` y confirmar cero fallos.
- [ ] Ejecutar `npm run typecheck`, `npm run lint` y `npm run build`; confirmar código 0.
- [ ] Ejecutar `npx supabase test db`; confirmar que los intentos cruzados y anónimos son rechazados.
- [ ] Recorrer detalle, edición, retiro, papelera y restauración en navegador local; comprobar textos, foco y estados.

## Auto-revisión

El plan cubre edición, retiro, papelera, restauración, permisos, multi-tenancy y estados completos. No modifica dinero, suscripciones ni historial; no incluye dashboard ni POS.
