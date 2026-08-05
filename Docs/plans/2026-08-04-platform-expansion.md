# Ampliación de FitManager

## Decisión aprobada

Completar primero el MVP operativo y desarrollar después POS, inventario, gastos y balance. Cada cambio de datos se entrega mediante migración incremental, RLS, permisos, auditoría y pruebas multi-tenant.

## Fase 1 — Personal, acceso y seguridad

- Invitar personal por correo mediante Supabase Auth desde servidor confiable.
- Listar nombre, correo laboral, código, estado, roles y permisos efectivos.
- Editar código y roles; activar, suspender y reactivar.
- Retirar mediante `soft_delete_entity('gym_user', ...)` y restaurar mediante RPC.
- Impedir retirar al último dueño activo y auditar cada cambio.
- Permisos: `staff.read`, `staff.manage` y `roles.manage`.

Terminado: dueño y gerente autorizado administran únicamente personal de su gimnasio; un usuario de otro gimnasio y un usuario sin permiso son rechazados.

## Fase 2 — CRUD administrativo del MVP

- Miembros: completar controles de edición, estado, borrado lógico y restauración.
- Sucursales: alta, edición, estado, borrado lógico y restauración.
- Planes y beneficios: alta, edición, activación, borrado lógico y restauración.
- No borrar físicamente relaciones históricas ni objetos de Storage.

## Fase 3 — Cobros, pagos y comprobantes

- Cargos y pagos atómicos, parciales y por moneda.
- Comprobante único y descargable por pago.
- Anulación o corrección auditada; nunca eliminación física.
- Alertas de morosidad y vencimiento.

## Fase 4 — Asistencia y notificaciones

- Entradas en tiempo real cuando exista una necesidad operativa comprobada.
- Detección configurable de inactividad.
- Alertas por vencimiento, cumpleaños e inactividad.
- Preferencias, consentimiento y canal de notificación.

## Fase 5 — Ingresos y reportes del MVP

- Ingresos diarios y mensuales separados por moneda.
- Membresías, pagos, morosidad, entradas e inactividad.
- No llamar balance a una cifra que no incluya gastos completos.

## Fase 6 — Promociones

- Campañas, segmentos, plantillas, programación, bajas y lista de exclusión.
- Proveedor de correo llamado únicamente desde un entorno confiable.

## Fase 7 — POS, inventario y finanzas ampliadas

- Productos, lotes, vencimiento, existencias y movimientos inmutables.
- Ventas, líneas, pagos, devoluciones y comprobantes.
- Ajustes de inventario con motivo y auditoría para reducir pérdidas.
- Gastos por categoría y moneda.
- Reportes de flujo e indicadores. El balance contable formal requiere reglas contables adicionales.

## Orden de verificación por tarjeta

1. Contrato y migración incremental.
2. RLS, permisos y auditoría.
3. Servicios y validación Zod.
4. Interfaz con carga, vacío, éxito, validación y error.
5. Pruebas autorizada, sin permiso, otro gimnasio y no autenticada.
6. Recorrido realista y actualización de documentación.
