# Dark Button Contrast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir globalmente la legibilidad de los botones en modo oscuro y usar verde como color principal.

**Architecture:** Añadir reglas de compatibilidad enfocadas en botones y enlaces con apariencia de botón dentro de `globals.css`. Mantener los nombres de utilidades existentes para evitar una migración amplia de componentes.

**Tech Stack:** Next.js, Tailwind CSS, Vitest.

---

### Task 1: Proteger el estado actual

**Files:** Ninguno.

- [ ] Crear la rama `backup-dark-buttons-before-green` en el commit base `e40f484`.
- [ ] Confirmar que `main` continúa limpio.

### Task 2: Especificar el contraste

**Files:**
- Create: `src/app/globals.test.ts`
- Modify: `src/app/globals.css`

- [ ] Crear una prueba que lea `globals.css` y exija fondo verde/texto blanco para primarios y texto verde claro para secundarios oscuros.
- [ ] Ejecutar la prueba y confirmar que falla antes del cambio.
- [ ] Añadir las reglas globales mínimas para que la prueba pase.
- [ ] Ejecutar nuevamente la prueba.

### Task 3: Verificar la aplicación

**Files:** Ninguno adicional.

- [ ] Ejecutar `npm.cmd test -- --run` y esperar cero fallos.
- [ ] Ejecutar `npm.cmd run lint` y esperar cero advertencias.
- [ ] Ejecutar `npm.cmd run typecheck` y esperar código 0.
- [ ] Ejecutar `npm.cmd run build` y esperar compilación exitosa.
- [ ] Revisar visualmente una pantalla autenticada en ambos temas.

