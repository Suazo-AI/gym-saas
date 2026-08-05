# Loading Skeletons y Búsquedas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unificar los estados de carga y hacer que las búsquedas naveguen sin recarga completa conservando el último término localmente.

**Architecture:** Componentes React cliente pequeños para búsqueda/persistencia y skeletons compartidos por ruta; las consultas permanecen server-side y respetan RLS.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind, Vitest.

---

### Task 1: Crear utilidades y pruebas de búsqueda

**Files:**
- Create: `src/features/app/components/persisted-search-form.tsx`
- Create: `src/features/app/components/persisted-search-form.test.tsx`

- [ ] Escribir pruebas para guardar/restaurar únicamente el término y construir la URL con `router.replace`.
- [ ] Implementar el formulario cliente con `useState`, `useEffect`, `localStorage` protegido para SSR y botón accesible de 44px.
- [ ] Ejecutar `npm.cmd test -- src/features/app/components/persisted-search-form.test.tsx`.

### Task 2: Crear skeletons compartidos y pruebas visuales

**Files:**
- Create: `src/features/app/components/page-skeleton.tsx`
- Create: `src/features/app/components/page-skeleton.test.tsx`

- [ ] Probar `role="status"`, `aria-label="Cargando"` y clases de animación.
- [ ] Implementar variantes `list`, `detail` y `dashboard` con superficies `bg-paper`, texto `text-ink` y bloques `animate-pulse`.
- [ ] Ejecutar las pruebas específicas.

### Task 3: Aplicar búsqueda persistente

**Files:**
- Modify: `src/app/members/page.tsx`
- Modify: `src/app/entries/page.tsx`
- Modify: `src/app/payments/new/page.tsx`
- Modify: `src/app/payments/day-pass/page.tsx`

- [ ] Sustituir formularios HTML de búsqueda por `PersistedSearchForm` manteniendo `searchParams` y filtros server-side.
- [ ] Conservar parámetros adicionales (`gymMemberId`, paginación) al seleccionar resultados.
- [ ] Ejecutar tests de páginas y comprobar que no haya `window` en Server Components.

### Task 4: Aplicar loading consistente

**Files:**
- Create/modify: `src/app/entries/loading.tsx`, `src/app/members/loading.tsx`, `src/app/members/deleted/loading.tsx`, `src/app/memberships/loading.tsx`, `src/app/payments/loading.tsx`, `src/app/payments/new/loading.tsx`, `src/app/payments/day-pass/loading.tsx`, `src/app/settings/loading.tsx`, `src/app/staff/loading.tsx`, `src/app/income/loading.tsx`, `src/app/dashboard/loading.tsx`.

- [ ] Reemplazar skeletons inconsistentes por `PageSkeleton` con la variante adecuada.
- [ ] Mantener estructura visual estable y soporte de `prefers-reduced-motion` mediante CSS existente.
- [ ] Ejecutar tests, lint, typecheck y build.

### Task 5: Verificar y entregar

- [ ] Ejecutar `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`.
- [ ] Ejecutar `git diff --check` y revisar estado.
- [ ] Crear commit y hacer push de la rama activa.
