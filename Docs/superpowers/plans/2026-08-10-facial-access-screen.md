# Facial Access Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear `/facial-access` como pantalla independiente, visible con `faces.read`, operable con `faces.verify` y probada contra usuarios autorizados, sin permiso y de otro gimnasio.

**Architecture:** Un Server Component resolverá el gimnasio activo y aplicará permisos con la RPC existente. Un componente cliente reutilizará `FaceCamera` y `POST /api/face/verify`; una migración incremental activará el catálogo sin mezclar permisos de Entradas.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Supabase PostgreSQL, pgTAP.

---

### Task 1: Exponer una consulta reutilizable de permisos

**Files:**
- Modify: `src/features/gyms/services/require-gym-permission.ts`
- Create: `src/features/gyms/services/require-gym-permission.test.ts`

- [ ] **Step 1: Escribir pruebas que fallen**

Crear mocks del cliente Supabase y probar que `hasGymPermission(gymId, code)` devuelve `true` o `false`, propaga errores mediante `mapSupabaseError`, y que `requireGymPermission` conserva el error `FORBIDDEN` cuando el resultado es falso.

- [ ] **Step 2: Verificar RED**

Run: `npm.cmd test -- src/features/gyms/services/require-gym-permission.test.ts`

Expected: FAIL porque `hasGymPermission` todavía no existe.

- [ ] **Step 3: Implementar la consulta mínima**

Extraer la llamada a `current_user_has_gym_permission`:

```ts
export async function hasGymPermission(gymId: string, permission: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_user_has_gym_permission" as never, {
    p_gym_id: gymId,
    p_permission_code: permission,
  } as never);
  if (error) throw mapSupabaseError(error);
  return data === true;
}
```

Hacer que `requireGymPermission` invoque esa función y mantenga el mismo `ApiError` cuando el permiso falta.

- [ ] **Step 4: Verificar GREEN**

Run: `npm.cmd test -- src/features/gyms/services/require-gym-permission.test.ts`

Expected: PASS.

### Task 2: Construir la experiencia de cámara integrada

**Files:**
- Create: `src/features/faces/components/facial-access-panel.tsx`
- Create: `src/features/faces/components/facial-access-panel.test.tsx`
- Reuse: `src/features/faces/capture/face-camera.tsx`
- Reuse: `src/app/api/face/verify/route.ts`

- [ ] **Step 1: Escribir pruebas que fallen**

Probar con `FaceCamera` sustituida por un stub que:

- con `canVerify=false` muestra modo lectura y no monta la cámara;
- con `canVerify=true` monta una cámara de un frame;
- al capturar envía solamente `imageBase64` a `/api/face/verify`;
- representa `allowed`, `denied`, `manual_review` y `no_match` con texto claro;
- representa errores HTTP sin exponer payload sensible.

- [ ] **Step 2: Verificar RED**

Run: `npm.cmd test -- src/features/faces/components/facial-access-panel.test.tsx`

Expected: FAIL porque el componente no existe.

- [ ] **Step 3: Implementar el componente mínimo**

Definir el contrato:

```ts
export function FacialAccessPanel({ canVerify }: { canVerify: boolean })
```

Cuando `canVerify` sea falso, renderizar un aviso de solo lectura. Cuando sea verdadero, renderizar `<FaceCamera frameCount={1} onCapture={verifyFrame} />`. `verifyFrame` hará `fetch("/api/face/verify", ...)`, guardará el resultado existente y mostrará estados `verifying`, `error` y `done`.

- [ ] **Step 4: Verificar GREEN**

Run: `npm.cmd test -- src/features/faces/components/facial-access-panel.test.tsx`

Expected: PASS.

### Task 3: Crear la ruta protegida y habilitar la navegación

**Files:**
- Create: `src/app/(gym)/facial-access/page.tsx`
- Create: `src/app/(gym)/facial-access/page.test.tsx`
- Modify: `src/features/app/components/app-shell.tsx`
- Modify: `src/features/app/components/app-shell.test.tsx`
- Modify: `src/features/app/components/preferences-controls.tsx`
- Modify: `src/features/app/components/preferences-controls.test.tsx`

- [ ] **Step 1: Escribir pruebas de ruta y navegación que fallen**

Probar que la página:

- redirige a `/login` si no hay gimnasio activo;
- llama `requireGymPermission(gymId, "faces.read")`;
- consulta `hasGymPermission(gymId, "faces.verify")`;
- muestra `FacialAccessPanel` con `canVerify=true` o `false` según la respuesta.

Agregar aserciones que exijan `"/facial-access"` en `supportedRoutes` y las etiquetas `Acceso facial` / `Facial access` para `facial_access`.

- [ ] **Step 2: Verificar RED**

Run: `npm.cmd test -- src/app/\(gym\)/facial-access/page.test.tsx src/features/app/components/app-shell.test.tsx src/features/app/components/preferences-controls.test.tsx`

Expected: FAIL por ruta y contratos ausentes.

- [ ] **Step 3: Implementar la ruta mínima**

La página resolverá el gimnasio activo, exigirá `faces.read`, consultará `faces.verify` y renderizará `ModuleHeader` más `FacialAccessPanel`. Agregar `/facial-access` al conjunto soportado y corregir la etiqueta heredada.

- [ ] **Step 4: Verificar GREEN**

Run: `npm.cmd test -- src/app/\(gym\)/facial-access/page.test.tsx src/features/app/components/app-shell.test.tsx src/features/app/components/preferences-controls.test.tsx`

Expected: PASS.

### Task 4: Activar el catálogo y congelar los tres perfiles en pgTAP

**Files:**
- Create: `supabase/migrations/20260810150000_activate_facial_access_screen.sql`
- Modify: `supabase/tests/face_access_contract.sql`

- [ ] **Step 1: Extender pgTAP antes de la migración**

Agregar aserciones para estado, ruta y permiso exclusivo de `facial_access`. Crear dentro de la transacción tres identidades de prueba: usuario con rol que incluya `faces.read`, usuario activo del mismo gimnasio sin ese permiso y usuario activo del segundo gimnasio. Usar `set local role authenticated` y `set local request.jwt.claims` para afirmar `true`, `false` y `false` respectivamente mediante `current_user_has_gym_permission`.

- [ ] **Step 2: Verificar RED**

Run: `npx.cmd supabase test db supabase/tests/face_access_contract.sql`

Expected: FAIL porque `facial_access.is_active` sigue en falso.

- [ ] **Step 3: Crear la migración incremental**

La migración hará:

```sql
update public.screens
set name = 'Acceso facial', route = '/facial-access', is_active = true
where code = 'facial_access';

delete from public.screen_permissions sp
using public.screens s, public.permissions p
where sp.screen_id = s.id
  and sp.permission_id = p.id
  and s.code = 'facial_access'
  and p.code <> 'faces.read';
```

Después garantizará con `insert ... on conflict do nothing` la asociación `facial_access` → `faces.read`. No modificará `entries`.

- [ ] **Step 4: Aplicar localmente y verificar GREEN**

Run: `npx.cmd supabase db reset`

Run: `npx.cmd supabase test db supabase/tests/face_access_contract.sql`

Expected: todas las aserciones PASS.

### Task 5: Regresión y verificación final

**Files:**
- Verify all modified files.

- [ ] **Step 1: Ejecutar pruebas focalizadas**

Run: `npm.cmd test -- src/features/gyms/services/require-gym-permission.test.ts src/features/faces/components/facial-access-panel.test.tsx src/app/\(gym\)/facial-access/page.test.tsx src/features/app/components/app-shell.test.tsx src/features/app/components/preferences-controls.test.tsx src/app/api/face/verify/route.test.ts src/features/faces/capture/face-camera.test.tsx`

Expected: PASS.

- [ ] **Step 2: Ejecutar validación completa**

Run: `npm.cmd run typecheck`

Run: `npm.cmd run lint`

Run: `npm.cmd test`

Run: `npm.cmd run build`

Expected: exit code 0 en cada comando.

- [ ] **Step 3: Verificar Supabase**

Run: `npx.cmd supabase test db`

Expected: todos los archivos pgTAP pasan, incluidos los tres perfiles faciales.

- [ ] **Step 4: Revisar el árbol**

Run: `git diff --check`

Run: `git status --short`

Expected: solamente los archivos de esta tarjeta, sin secretos ni artefactos generados.
