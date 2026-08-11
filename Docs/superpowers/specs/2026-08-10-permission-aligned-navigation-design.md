# Personal, permisos y navegacion autorizada

## Objetivo

Completar la tarjeta "Diseñar gestión de personal y permisos" para que la interfaz refleje la matriz de permisos existente tanto en el gimnasio como en la consola SaaS. El alcance no crea roles de plataforma nuevos: la consola SaaS continúa reservada al `platform_role=admin` aprobado.

## Alcance

### Gimnasio

- Mantener el flujo existente para invitar personal, asignar uno o varios roles y suspender o reactivar el acceso.
- Mostrar los permisos efectivos resultantes de todos los roles asignados.
- Traducir los códigos de permiso a descripciones claras y agruparlos por capacidad para evitar exponer solamente nombres técnicos.
- Mostrar en cada rol qué acciones permite y cuáles quedan fuera de sus límites.
- Obtener el menú desde las pantallas autorizadas por permisos efectivos y conservar `staff.manage` como requisito de la pantalla de personal.
- Mantener la autorización real en RPC, RLS y acciones de servidor. Los controles visuales solamente explican el alcance; no constituyen la frontera de seguridad.

### Plataforma SaaS

- Mantener el único rol global existente: `platform_role=admin`.
- Centralizar la validación de ese rol para evitar comprobaciones divergentes entre rutas.
- Derivar el menú de plataforma de una lista de rutas autorizadas para el administrador.
- Validar cada ruta de plataforma en el servidor aunque un enlace no se muestre.
- No implementar invitaciones, roles adicionales ni una matriz nueva para personal interno de la plataforma.

## Flujo y estados

La pantalla de personal muestra el formulario de invitación y el equipo actual. Cada usuario muestra estado, roles y permisos efectivos. Un usuario suspendido puede reactivarse seleccionando `Activo`; uno activo puede suspenderse. Las operaciones muestran confirmación o un error en español sin revelar detalles internos.

La selección de roles presenta una descripción breve de sus capacidades y límites antes de guardar. La lista de permisos efectivos se recalcula desde el contrato del servidor después de cada actualización; no se deduce en el navegador.

En la consola SaaS, un administrador ve el menú completo aprobado. Cualquier usuario sin `platform_role=admin` es redirigido fuera de todas las rutas `/platform`, incluso si escribe la URL directamente.

## Arquitectura

- Reutilizar `list_gym_staff`, `link_invited_gym_staff_user`, `update_gym_staff_user` y la matriz `roles` / `role_permissions` / `screen_permissions`.
- Ampliar los DTO y componentes solamente si el contrato existente no entrega las descripciones necesarias.
- Crear una utilidad de servidor para exigir acceso de plataforma y reutilizarla en las páginas o layout de `/platform`.
- Mantener listas de rutas soportadas como una restricción de aplicación, pero filtrarlas por la autorización obtenida del servidor.
- Cualquier cambio de contrato Supabase será una migración incremental con pruebas pgTAP; no se editarán migraciones aplicadas.

## Errores y seguridad

- Un usuario sin `staff.manage` no puede listar ni modificar personal mediante RPC o acceso directo.
- Un usuario suspendido deja de obtener pantallas y permisos efectivos del gimnasio.
- Ninguna acción acepta el `gym_id` del navegador como autoridad; se usa el gimnasio activo validado en servidor y las RPC vuelven a comprobar pertenencia y permiso.
- El último dueño activo no puede suspenderse ni perder su rol, conservando la regla existente.
- Las rutas SaaS no confían en el menú: validan sesión y `app_metadata.platform_role` en servidor.
- No se exponen secretos, `service_role` ni datos de otro gimnasio.

## Pruebas

- Componentes: invitación, roles con capacidades y límites, permisos efectivos, suspensión y reactivación.
- Navegación gym: solo aparecen pantallas respaldadas por permisos efectivos.
- Acciones y repositorios: éxito autorizado y rechazo sin permiso, suspendido y otro gimnasio.
- Plataforma: el administrador obtiene rutas autorizadas y un usuario sin rol global es rechazado en todas las rutas.
- pgTAP: conservar o ampliar cobertura de `staff.manage`, aislamiento entre gimnasios, estado suspendido y protección del último dueño cuando cambie el contrato SQL.
- Verificación final: pruebas relevantes, suite completa, lint, typecheck y build.

## Criterio de terminado

La interfaz permite invitar, asignar roles, ver permisos efectivos, suspender y reactivar personal del gimnasio; explica límites sin depender de botones ocultos. Los menús del gimnasio y de la plataforma coinciden con sus autorizaciones aprobadas, y las rutas rechazan accesos directos no autorizados en el servidor.
