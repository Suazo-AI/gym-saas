# Entry Member Search Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar la pantalla existente de Entradas para buscar miembros por nombre, teléfono o código y mostrar estados de acceso claros sin exponer datos sensibles.

**Architecture:** Una RPC `search_entry_members` con `security invoker` buscará dentro del gimnasio activo y devolverá exclusivamente el resumen público existente, nunca el teléfono. La página `/entries` usará un repositorio enfocado para esa búsqueda y un presentador puro convertirá el detalle seleccionado en una alerta operacional mínima; la RPC existente seguirá decidiendo el registro de entrada.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase/PostgreSQL, pgTAP, Vitest.

---

### Task 1: Contrato seguro de búsqueda para Entradas

**Files:**
- Create: `supabase/migrations/20260810160000_entry_member_phone_search.sql`
- Modify: `supabase/tests/member_entries.sql`

- [ ] **Step 1: Escribir pruebas pgTAP que fallen**

Agregar casos que invoquen `search_entry_members(gym_id, search, limit)` y verifiquen: coincidencia por nombre, código y teléfono; ausencia de columnas telefónicas en el resultado; cero filas al buscar el teléfono de otro gimnasio; rechazo sin `entries.read`.

```sql
select results_eq(
  $$select member_code from public.search_entry_members(
    '20000000-0000-4000-8000-000000000001', '88881111', 10
  )$$,
  $$values ('M-001'::text)$$,
  'entry search finds a same-gym member by phone'
);

select is_empty(
  $$select * from public.search_entry_members(
    '20000000-0000-4000-8000-000000000001', '77772222', 10
  )$$,
  'entry search does not reveal another gym phone'
);
```

- [ ] **Step 2: Ejecutar RED**

Run: `npx supabase test db supabase/tests/member_entries.sql`

Expected: FAIL porque `public.search_entry_members` todavía no existe.

- [ ] **Step 3: Crear la RPC mínima**

Crear una función estable, `security invoker`, con `search_path=''`, límite entre 1 y 10, validación de `entries.read`, filtro obligatorio `s.gym_id = p_gym_id` y coincidencia normalizada contra `s.full_name`, `s.member_code` o un `exists` sobre `person_contacts` de tipo `phone`. Retornar solamente:

```sql
returns table (
  gym_id uuid,
  gym_member_id uuid,
  member_code text,
  full_name text,
  status text,
  membership_status text,
  has_overdue_charges boolean
)
```

Revocar acceso público y otorgar `execute` solamente a `authenticated`.

- [ ] **Step 4: Ejecutar GREEN**

Run: `npx supabase test db supabase/tests/member_entries.sql`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260810160000_entry_member_phone_search.sql supabase/tests/member_entries.sql
git commit -m "feat(entries): add private member phone search"
```

### Task 2: Repositorio de búsqueda con DTO mínimo

**Files:**
- Create: `src/features/entries/services/entry-member-search.repository.ts`
- Create: `src/features/entries/services/entry-member-search.repository.test.ts`
- Modify: `src/features/entries/types/entry.dto.ts`

- [ ] **Step 1: Escribir el test que falle**

Probar con un RPC inyectado que se llama `search_entry_members` con `p_gym_id`, término recortado y `p_limit: 10`, y que el DTO resultante solo contiene `gymMemberId`, `memberCode`, `fullName`, `status`, `membershipStatus` y `hasOverdueCharges`.

```ts
expect(result[0]).toEqual({
  gymMemberId: "member-1",
  memberCode: "M-001",
  fullName: "Ana Pérez",
  status: "active",
  membershipStatus: "active",
  hasOverdueCharges: false,
});
expect(result[0]).not.toHaveProperty("phone");
```

- [ ] **Step 2: Ejecutar RED**

Run: `npm test -- src/features/entries/services/entry-member-search.repository.test.ts`

Expected: FAIL porque el repositorio no existe.

- [ ] **Step 3: Implementar el repositorio mínimo**

Crear `searchEntryMembers({ gymId, search }, injectedRpc?)`; rechazar términos vacíos devolviendo `[]`, llamar la RPC y mapear explícitamente las seis propiedades permitidas. Usar `mapSupabaseError` para errores.

- [ ] **Step 4: Ejecutar GREEN**

Run: `npm test -- src/features/entries/services/entry-member-search.repository.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/entries/services/entry-member-search.repository.ts src/features/entries/services/entry-member-search.repository.test.ts src/features/entries/types/entry.dto.ts
git commit -m "feat(entries): query private member search results"
```

### Task 3: Alerta operacional privada

**Files:**
- Create: `src/features/entries/components/entry-access-notice.tsx`
- Create: `src/features/entries/components/entry-access-notice.test.tsx`
- Modify: `src/app/(gym)/entries/page.tsx`
- Modify: `src/app/(gym)/entries/page.test.tsx`

- [ ] **Step 1: Escribir tests que fallen**

Cubrir un miembro activo sin deuda (`Acceso permitido`, `role="status"`) y estados bloqueado, vencido, moroso o sin membresía (`Acceso no permitido`, `Revisar membresía en recepción`, `role="alert"`). Incluir valores sensibles en el fixture y afirmar que el HTML no contiene teléfono, correo, monto, fecha ni detalle de cargos.

- [ ] **Step 2: Ejecutar RED**

Run: `npm test -- src/features/entries/components/entry-access-notice.test.tsx "src/app/(gym)/entries/page.test.tsx"`

Expected: FAIL porque el componente no existe y la página aún usa `listMembers`.

- [ ] **Step 3: Implementar el componente y conectar la pantalla**

Crear un componente que derive permiso visual solo para orientar recepción:

```ts
const allowed = member.status === "active"
  && ["active", "trialing"].includes(member.membershipStatus ?? "")
  && !member.hasOverdueCharges;
```

Renderizar únicamente título y acción genérica. Sustituir `listMembers` por `searchEntryMembers`, mantener `gymId` del servidor, conservar nombre/código en resultados y actualizar todos los textos a “nombre, teléfono o código”. El formulario y la RPC de registro permanecen intactos.

- [ ] **Step 4: Ejecutar GREEN**

Run: `npm test -- src/features/entries/components/entry-access-notice.test.tsx "src/app/(gym)/entries/page.test.tsx"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/entries/components/entry-access-notice.tsx src/features/entries/components/entry-access-notice.test.tsx "src/app/(gym)/entries/page.tsx" "src/app/(gym)/entries/page.test.tsx"
git commit -m "feat(entries): show private access guidance"
```

### Task 4: Verificación integral

**Files:**
- Verify only.

- [ ] **Step 1: Ejecutar pruebas focales**

Run: `npm test -- src/features/entries`

Expected: PASS.

- [ ] **Step 2: Ejecutar contratos SQL**

Run: `npx supabase test db`

Expected: PASS.

- [ ] **Step 3: Ejecutar preflight**

Run: `npm run preflight`

Expected: typecheck, lint, tests y build en PASS.

- [ ] **Step 4: Revisar el diff**

Run: `git diff --check && git status --short`

Expected: sin errores de whitespace y solo archivos de esta tarjeta.
