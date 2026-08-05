# Skeletons y búsquedas sin recarga

## Objetivo

Mejorar la percepción de carga en todas las rutas operativas y evitar recargas completas al buscar.

## Diseño

- Cada ruta dinámica tendrá un `loading.tsx` basado en un componente visual compartido con bloques animados, contraste claro/oscuro y altura reservada.
- Las búsquedas usarán un componente cliente que guarda únicamente el último término en `localStorage` y llama `router.replace()` con los parámetros existentes.
- El servidor seguirá ejecutando `listMembers` y las demás consultas bajo el gimnasio activo y RLS; `localStorage` solo conserva la experiencia del formulario.
- Se cubrirán miembros, entradas, pagos, membresías, configuración, papelera y rutas de alta/búsqueda que actualmente carecen de loading.

## Verificación

Se agregarán pruebas para persistencia segura del término, navegación sin submit HTML y presencia de `role="status"`/skeleton en las rutas principales. Se ejecutarán tests, lint, typecheck y build.
