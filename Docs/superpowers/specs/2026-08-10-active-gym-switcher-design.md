# Selector de gimnasio activo

## Objetivo

Permitir que un usuario con membresía activa en dos o más gimnasios cambie el
gimnasio activo desde la interfaz. La selección es contexto de sesión/dispositivo,
no una autorización ni una preferencia global sincronizada.

## Experiencia de usuario

- El selector vive en la tarjeta `Gimnasio activo` del sidebar existente.
- Con un solo gimnasio se conserva la presentación actual sin control de cambio.
- Con dos o más gimnasios se muestra un `select` accesible con los gimnasios que
  el servidor confirmó para el usuario.
- Al elegir otro gimnasio se ejecuta una Server Action, se actualiza el contexto
  y se redirige a `/dashboard` para evitar conservar identificadores o filtros del
  gimnasio anterior.
- Durante el envío el control comunica estado pendiente y evita envíos repetidos.

## Persistencia y evolución móvil

La web guarda el identificador seleccionado en una cookie `httpOnly`, `sameSite=lax`,
con `secure` en producción. Una futura aplicación móvil podrá guardar el mismo tipo
de selección en almacenamiento seguro del dispositivo y enviarla a endpoints que
repitan la validación server-side.

No se guarda el gimnasio activo en PostgreSQL: hacerlo sincronizaría de forma
inesperada sesiones distintas. En el futuro puede agregarse un `default_gym_id`
como preferencia inicial, separado del contexto activo de cada dispositivo.

## Seguridad y multi-tenancy

- El valor recibido desde el formulario y la cookie nunca es confiable.
- `getActiveGym()` obtiene primero `getUserGyms()` y solo acepta la cookie si su
  `gymId` coincide con una membresía activa y no eliminada en un gimnasio activo.
- La Server Action vuelve a consultar `getUserGyms()` antes de escribir la cookie.
- Un UUID manipulado, un gimnasio ajeno, una membresía suspendida o un gimnasio
  archivado se rechazan sin revelar información del gimnasio solicitado.
- Las consultas de cada módulo continúan recibiendo el `gymId` producido por
  `getActiveGym()` y conservan RLS, permisos y validaciones existentes.
- No se agrega tabla, RPC ni migración; la fuente de autorización sigue siendo
  Supabase.

## Componentes y flujo

1. El layout obtiene `getUserGyms()` y `getActiveGym()` en servidor.
2. `AppShell` recibe la lista autorizada y el gimnasio activo.
3. `ActiveGymSwitcher` muestra texto o selector según la cantidad disponible.
4. `switchActiveGymAction` valida el UUID contra la lista autorizada, escribe la
   cookie, revalida el layout y redirige a `/dashboard`.
5. En el siguiente request, `getActiveGym()` resuelve la cookie validada.

## Errores y recuperación

- Selección inválida: no se modifica la cookie y se devuelve un error genérico.
- Cookie inválida o revocada: se ignora y se usa el primer gimnasio autorizado.
- Sin gimnasios autorizados: se mantiene el flujo actual de redirección a login.
- Fallo transitorio: el selector vuelve a habilitarse y muestra un mensaje
  accesible sin exponer identificadores internos.

## Pruebas

- `getActiveGym()` usa una selección válida y marca su fuente como `cookie`.
- Cookie manipulada, gimnasio ajeno o membresía inactiva caen al primer gimnasio.
- La Server Action escribe opciones seguras solo para un gimnasio autorizado.
- La Server Action no escribe cookie para una selección inválida.
- Un gimnasio muestra texto; dos gimnasios muestran selector.
- El selector contiene únicamente gimnasios autorizados y comunica errores.
- El cambio mantiene aislamiento y los tests existentes continúan pasando.

## Fuera de alcance

- Sincronizar el gimnasio activo entre dispositivos.
- Agregar `default_gym_id`.
- Cambiar roles, permisos o membresías de gimnasio.
- Cambiar rutas de módulos o introducir una app móvil.
