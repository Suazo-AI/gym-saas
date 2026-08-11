# Active Gym Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cambiar de forma segura el gimnasio activo desde el sidebar cuando el usuario tiene varias membresías.

**Architecture:** Una cookie de sesión `httpOnly` conserva el contexto por navegador. `getActiveGym` y una Server Action validan siempre el valor contra `getUserGyms`; un componente cliente solo presenta las opciones autorizadas recibidas del servidor.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase SSR, Vitest.

---

### Task 1: Resolver el gimnasio activo desde una cookie validada

**Files:**
- Modify: `src/features/gyms/types/gym.dto.ts`
- Modify: `src/features/gyms/services/get-active-gym.ts`
- Create: `src/features/gyms/services/get-active-gym.test.ts`

- [ ] Escribir tests con gateways inyectados para selección válida, UUID ajeno, cookie vacía, un gimnasio y cero gimnasios.
- [ ] Ejecutar `npm test -- src/features/gyms/services/get-active-gym.test.ts`; debe fallar porque el resolver inyectable y `selectionSource: "cookie"` no existen.
- [ ] Crear `resolveActiveGym(gyms, selectedGymId)` como función pura y hacer que `getActiveGym` lea `fitmanager-active-gym` mediante `cookies()`. Restaurar el import faltante de `cache`.
- [ ] Repetir el test; debe pasar.
- [ ] Commit: `feat(gyms): resolve validated active gym selection`.

### Task 2: Server Action segura para cambiar gimnasio

**Files:**
- Create: `src/features/gyms/actions/active-gym.actions.ts`
- Create: `src/features/gyms/actions/active-gym.actions.test.ts`

- [ ] Escribir tests con dependencias inyectadas que comprueben que una membresía válida escribe `fitmanager-active-gym` con `httpOnly`, `sameSite: "lax"`, `secure` en producción y `path: "/"`; una selección ajena o inválida no escribe.
- [ ] Ejecutar `npm test -- src/features/gyms/actions/active-gym.actions.test.ts`; debe fallar porque la acción no existe.
- [ ] Implementar `switchActiveGymAction(previousState, formData, dependencies?)`: validar UUID, consultar `getUserGyms`, escribir cookie solo tras coincidencia, revalidar layout y redirigir a `/dashboard`; devolver mensaje genérico en errores validables.
- [ ] Repetir el test; debe pasar.
- [ ] Commit: `feat(gyms): add secure active gym action`.

### Task 3: Selector accesible en el sidebar

**Files:**
- Create: `src/features/gyms/components/active-gym-switcher.tsx`
- Create: `src/features/gyms/components/active-gym-switcher.test.tsx`
- Modify: `src/features/app/components/app-shell.tsx`
- Modify: `src/app/(gym)/layout.tsx`
- Modify: `src/features/app/components/app-shell.test.tsx`

- [ ] Escribir tests: una opción renderiza texto sin `select`; dos opciones renderizan solo gimnasios autorizados, selección actual, estado pendiente y región de error accesible.
- [ ] Ejecutar los tests focales; deben fallar porque el componente y las props nuevas no existen.
- [ ] Implementar el componente con `useActionState` y `useFormStatus`; conectar `getUserGyms()` en el layout y pasar `availableGyms` a `AppShell`.
- [ ] Repetir los tests focales; deben pasar.
- [ ] Commit: `feat(gyms): add active gym sidebar switcher`.

### Task 4: Verificación y PR

**Files:**
- Verify only.

- [ ] Ejecutar `npm test -- src/features/gyms src/features/app/components/app-shell.test.tsx`.
- [ ] Ejecutar `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`.
- [ ] Ejecutar `git diff --check` y confirmar rama limpia.
- [ ] Subir `feat/active-gym-switcher` y crear PR hacia `develop`, porque la rama se creó desde `develop` y allí ya está mergeado PR #69.
