# Administración de miembros desde el detalle

**Fecha:** 2026-08-04  
**Tarjeta:** Módulo de miembros  
**Estado:** diseño aprobado; pendiente de revisión escrita e implementación

## Objetivo

Permitir que un usuario autorizado edite, retire y restaure miembros únicamente dentro del gimnasio activo, sin borrar historial ni depender de autorización visual.

## Alcance

La página `/members/[gymMemberId]` incorporará:

- formulario de edición para nombre, apellido, código de miembro, sucursal principal, teléfono y correo;
- acción de retiro lógico con motivo obligatorio y confirmación explícita;
- mensajes de carga, validación, éxito, conflicto, permiso y error;
- controles visibles solo cuando el usuario tenga `members.manage`.

La pantalla `/members` conservará su función de búsqueda y filtros. Incluirá un acceso a una papelera separada para usuarios con `members.manage`. La papelera listará miembros retirados del gimnasio activo y permitirá restaurarlos.

## Contratos existentes

- Edición: RPC `update_gym_member`.
- Retiro: RPC `soft_delete_entity('gym_member', ...)`.
- Restauración: RPC `restore_entity('gym_member', ...)`.
- Papelera: RPC `list_deleted_entities(gym_id, 'gym_member', ...)`.

No se creará `DELETE` físico ni se actualizarán directamente `deleted_at`, `deleted_by` o `deletion_reason`.

## Seguridad y multi-tenancy

El `gym_id` se derivará de `getActiveGym()` en servidor y no se aceptará desde el navegador. La página de detalle seguirá consultando por `gym_id + gym_member_id`. Las RPC validarán usuario autenticado, pertenencia activa, permiso `members.manage`, gimnasio y estado lógico.

Un usuario sin permiso no verá controles administrativos, pero esa ocultación será solamente de experiencia de usuario. Las pruebas intentarán editar, retirar, listar retirados y restaurar desde otro gimnasio.

## Flujo de edición

1. El servidor carga el miembro y las sucursales visibles del gimnasio activo.
2. El usuario abre “Editar miembro”.
3. El formulario valida con Zod y envía únicamente identificador del miembro y campos editables.
4. La Server Action deriva el gimnasio activo.
5. `update_gym_member` aplica la operación y devuelve el resumen actualizado.
6. Se revalida el detalle y el listado de miembros.

Un código duplicado, sucursal ajena o miembro retirado se mostrará como conflicto o regla de negocio sin exponer errores internos.

## Flujo de retiro

1. El usuario abre una sección de peligro dentro del detalle.
2. La interfaz explica que el historial financiero y de acceso se conserva.
3. El usuario escribe un motivo de al menos tres caracteres y confirma.
4. La Server Action ejecuta `soft_delete_entity`.
5. Tras éxito, redirige al listado con confirmación.

No se permitirá retirar un miembro mediante un botón de un solo clic.

## Papelera y restauración

La papelera mostrará nombre/código, fecha de retiro y motivo. La restauración exigirá una acción explícita, ejecutará `restore_entity` y revalidará listado, detalle y papelera. Si el código activo ya fue reutilizado, se mostrará el conflicto y no se alterará ningún registro.

## Componentes

- `MemberDetailView`: conserva resumen operativo y aloja acciones autorizadas.
- `MemberEditForm`: formulario cliente aislado.
- `MemberRetireForm`: confirmación y motivo.
- `DeletedMembers`: lista y restauración.
- Server Actions: edición, retiro y restauración con estados serializables.
- Repositorio: contratos tipados para papelera y permisos efectivos.

## Pruebas y terminado

- Esquemas: normalización, UUID y motivo obligatorio.
- Repositorio: gimnasio activo, RPC correctas y mapeo de papelera.
- Actions: ignoran `gym_id` del formulario y traducen errores.
- Componentes: edición, peligro, papelera, estados y ocultación sin permiso.
- SQL: autorizado, sin permiso, otro gimnasio y anónimo.
- Verificación: pruebas focalizadas, suite completa, typecheck, lint, build y recorrido realista.

La tarjeta estará terminada cuando un usuario autorizado pueda editar, retirar y restaurar un miembro de su gimnasio, y todos los intentos cruzados sean rechazados sin modificar historial.

## Fuera de esta tarjeta

- Dashboard del dueño.
- Mini punto de venta, productos e inventario.
- Cambios financieros de membresías.
- Borrado físico de miembros o historial.
