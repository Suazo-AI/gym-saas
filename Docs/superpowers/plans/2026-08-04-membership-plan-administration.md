# Membership Plan Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un usuario con `memberships.manage` administre planes y beneficios de su gimnasio con duración diaria, semanal o mensual, montos decimales y borrado lógico seguro.

**Architecture:** Una migración incremental amplía el contrato existente sin reescribir migraciones aplicadas y conserva `billing_cycle_months` mientras las RPC históricas sigan dependiendo de él. Next.js usa Server Actions y Zod; el gimnasio se deriva de la sesión, RLS/RPC autorizan y los montos permanecen como cadenas decimales.

**Tech Stack:** PostgreSQL/Supabase RLS y RPC, Next.js App Router, TypeScript, Zod, Vitest, pgTAP.

---

## Alcance y límites

Este plan cubre únicamente administración de planes y beneficios. La creación/renovación de suscripciones, generación de cargos, pago completo, congelamiento, cambio de plan, crédito y reembolso se implementarán en un plan financiero posterior. No se habilitará una duración diaria o semanal en suscripciones hasta que las RPC financieras consuman el nuevo contrato.

### Task 1: Contrato incremental de duración y renovación

**Files:**
- Create: `supabase/migrations/20260804030000_membership_plan_duration_contract.sql`
- Create: `supabase/tests/membership_plan_duration_contract.sql`

- [x] **Step 1: Escribir pruebas SQL fallidas**

Probar con pgTAP que `membership_plans` expone `duration_count`, `duration_unit` y `auto_renew`; que solo admite `day`, `week` o `month`; que cantidad, precio y gracia no aceptan valores inválidos; y que los planes mensuales existentes se migran desde `billing_cycle_months`.

- [x] **Step 2: Ejecutar la prueba y confirmar el fallo**

Run: `npx supabase test db supabase/tests/membership_plan_duration_contract.sql`

Expected: FAIL porque las columnas nuevas todavía no existen.

- [x] **Step 3: Crear la migración incremental mínima**

Agregar columnas con restricciones explícitas:

```sql
alter table public.membership_plans
  add column duration_count integer,
  add column duration_unit text,
  add column auto_renew boolean not null default true;

update public.membership_plans
set duration_count = billing_cycle_months,
    duration_unit = 'month';

alter table public.membership_plans
  alter column duration_count set not null,
  alter column duration_unit set not null,
  add constraint membership_plans_duration_count_positive check (duration_count > 0),
  add constraint membership_plans_duration_unit_valid check (duration_unit in ('day', 'week', 'month'));
```

Mantener `billing_cycle_months` por compatibilidad con las RPC existentes. La interfaz de asignación no ofrecerá planes diarios/semanales hasta migrar el ciclo financiero de suscripciones.

- [x] **Step 4: Verificar migración y aislamiento**

Run: `npx supabase db reset`

Run: `npx supabase test db supabase/tests/membership_plan_duration_contract.sql`

Expected: PASS, incluyendo usuario autorizado, sin permiso, otro gimnasio y anónimo.

- [ ] **Step 5: Regenerar tipos**

Run: `npx supabase gen types typescript --local`

Actualizar `src/types/database.types.ts` con la salida generada, sin edición manual del contrato.

### Task 2: Esquemas de entrada y dinero como texto

**Files:**
- Create: `src/features/memberships/schemas/membership-plan.schema.ts`
- Create: `src/features/memberships/schemas/membership-plan.schema.test.ts`

- [x] **Step 1: Escribir pruebas fallidas del esquema**

Cubrir normalización de código, descripción opcional, precio decimal con máximo dos decimales, monedas `USD|NIO`, cantidad positiva, unidad válida, gracia desde cero, renovación y beneficio con código/descripción.

- [x] **Step 2: Ejecutar y confirmar el fallo**

Run: `npm test -- src/features/memberships/schemas/membership-plan.schema.test.ts`

Expected: FAIL porque el esquema no existe.

- [x] **Step 3: Implementar el esquema mínimo**

Usar una expresión decimal textual, sin convertir dinero a `number`:

```ts
const money = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Escribe un monto válido.");
const durationUnit = z.enum(["day", "week", "month"]);
```

Exportar `membershipPlanSchema`, `updateMembershipPlanSchema`, `retireMembershipPlanSchema`, `restoreMembershipPlanSchema` y los tipos inferidos.

- [x] **Step 4: Ejecutar la prueba**

Run: `npm test -- src/features/memberships/schemas/membership-plan.schema.test.ts`

Expected: PASS.

### Task 3: Repositorio limitado al gimnasio activo

**Files:**
- Modify: `src/features/memberships/types/membership.dto.ts`
- Modify: `src/features/memberships/services/membership.repository.ts`
- Create: `src/features/memberships/services/membership.repository.test.ts`

- [x] **Step 1: Escribir pruebas fallidas del repositorio**

Verificar listado con beneficios, creación usando el `gymId` del servidor, actualización con filtros por `id`, `gym_id` y `deleted_at is null`, y retiro/restauración mediante `soft_delete_entity`/`restore_entity` con `p_entity = 'membership_plan'`.

- [x] **Step 2: Ejecutar y confirmar el fallo**

Run: `npm test -- src/features/memberships/services/membership.repository.test.ts`

Expected: FAIL porque las operaciones administrativas no existen.

- [x] **Step 3: Implementar gateways inyectables**

Agregar `createMembershipPlan`, `updateMembershipPlan`, `retireMembershipPlan`, `restoreMembershipPlan`, `listDeletedMembershipPlans` y `canManageMembershipPlans`. Mapear `price` a `string` y nunca aceptar `gymId` desde FormData.

- [x] **Step 4: Ejecutar la prueba**

Run: `npm test -- src/features/memberships/services/membership.repository.test.ts`

Expected: PASS.

### Task 4: Server Actions seguras

**Files:**
- Create: `src/features/memberships/actions/membership-plan.actions.ts`
- Create: `src/features/memberships/actions/membership-plan.actions.test.ts`

- [x] **Step 1: Escribir pruebas fallidas**

Comprobar que las acciones derivan `gymId` con `getActiveGym`, ignoran cualquier gimnasio enviado, validan Zod, traducen conflictos de código y revalidan `/memberships` solo después del éxito.

- [x] **Step 2: Ejecutar y confirmar el fallo**

Run: `npm test -- src/features/memberships/actions/membership-plan.actions.test.ts`

Expected: FAIL porque las acciones no existen.

- [x] **Step 3: Implementar acciones**

Crear acciones de alta, edición, retiro y restauración. Devolver estados serializables `{ ok, message }`; no devolver errores internos de Supabase.

- [x] **Step 4: Ejecutar la prueba**

Run: `npm test -- src/features/memberships/actions/membership-plan.actions.test.ts`

Expected: PASS.

### Task 5: Interfaz de planes y beneficios

**Files:**
- Modify: `src/app/memberships/page.tsx`
- Create: `src/app/memberships/loading.tsx`
- Create: `src/features/memberships/components/membership-plan-management.tsx`
- Create: `src/features/memberships/components/membership-plan-management.test.tsx`

- [x] **Step 1: Escribir prueba fallida del componente**

Estado: completada para alta, edición, duración, permisos, beneficios, retiro y papelera.

Renderizar alta, edición, estado, duración localizada, beneficios, retiro y papelera. Asegurar que no aparezcan términos técnicos como RLS, RPC, Supabase o CRUD.

- [x] **Step 2: Ejecutar y confirmar el fallo**

Run: `npm test -- src/features/memberships/components/membership-plan-management.test.tsx`

Expected: FAIL porque el componente no existe.

- [x] **Step 3: Implementar estados completos**

Estado: implementados carga, error, vacío, permiso, mensajes de acción y gestión de beneficios.

Mostrar carga, error, vacío, validación, éxito, sin permiso y conflicto. Ocultar controles sin `memberships.manage`, manteniendo RLS/RPC como autoridad real. Etiquetar claramente precio, moneda, duración, gracia y renovación.

- [x] **Step 4: Ejecutar la prueba**

Run: `npm test -- src/features/memberships/components/membership-plan-management.test.tsx`

Expected: PASS.

### Task 6: Verificación integral

**Files:**
- Modify: `README.md`

- [x] **Step 1: Ejecutar pruebas focalizadas**

Run: `npm test -- src/features/memberships`

Expected: PASS.

- [x] **Step 2: Ejecutar calidad estática**

Run: `npm run typecheck`

Run: `npm run lint`

Expected: ambos comandos terminan con código 0.

- [x] **Step 3: Ejecutar build**

Run: `npm run build`

Expected: build de producción exitoso.

- [ ] **Step 4: Ejecutar pruebas SQL completas**

Run: `npx supabase test db`

Expected: todos los archivos pgTAP pasan.

- [ ] **Step 5: Documentar el contrato**

Añadir al README el comando de pruebas y dejar explícito que planes diarios/semanales no pueden asignarse hasta completar la migración financiera de suscripciones y cargos.

## Auto-revisión

- El plan cubre alta, edición, beneficios, activación, retiro y restauración.
- El aislamiento se prueba en PostgreSQL y el frontend nunca decide autorización.
- El dinero se mantiene como texto en TypeScript y `numeric` en PostgreSQL.
- No modifica migraciones aplicadas ni registros históricos.
- Se separa deliberadamente el ciclo financiero, porque requiere RPC atómicas y pruebas de mayor riesgo.
