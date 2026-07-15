# AGENTS.md — Gym SaaS

## Preflight obligatorio — antes de hacer cualquier cosa

Estas instrucciones aplican a todo el proyecto y a todos los agentes.

Antes de analizar, planificar, editar archivos, instalar paquetes, ejecutar migraciones o escribir código, el agente debe:

1. Leer completamente este `AGENTS.md`.
2. Leer `TRELLO.md` para conocer el backlog y las decisiones pendientes.
3. Identificar la tarjeta o resultado concreto que trabajará.
4. Confirmar que la tarea está dentro del MVP y no contradice una decisión existente.
5. Revisar el estado actual del repositorio y preservar cambios ajenos.
6. No comenzar implementación si falta una decisión que afecte dinero, seguridad, permisos, multi-tenancy o alcance.

Si `AGENTS.md` y `TRELLO.md` se contradicen, `AGENTS.md` gobierna las reglas y decisiones del producto; la discrepancia debe informarse y corregirse antes de continuar.

Este preflight es obligatorio. No puede omitirse para ahorrar tiempo.

## Objetivo del producto

Construir un SaaS multi-tenant para administrar gimnasios pequeños de Nicaragua. La primera versión debe resolver el trabajo diario de recepción y darle al dueño control claro sobre miembros, membresías, pagos, morosidad y entradas.

El producto comenzará con gimnasios de aproximadamente 25–100 miembros y luego podrá evolucionar para negocios mayores.

## Usuario y problema principal

Usuarios iniciales:

- Dueño del gimnasio.
- Gerente.
- Recepcionista.
- Administrador interno de la plataforma SaaS.

Hipótesis principal por validar con al menos 10 dueños: los gimnasios pierden tiempo y control al manejar pagos, vencimientos y miembros activos mediante papel, Excel y WhatsApp.

No tratar esta hipótesis como confirmada hasta completar las entrevistas.

## Alcance del MVP

Incluir:

- Registro y configuración de gimnasios.
- Separación estricta de datos entre gimnasios.
- Usuarios, roles y permisos.
- Registro y búsqueda de miembros.
- Planes y membresías.
- Estados de membresía y vencimientos.
- Pagos, recibos y morosidad.
- Entradas al gimnasio.
- Apertura y cierre básico de caja.
- Reportes esenciales.
- Operación en USD y NIO.
- Tasa inicial de referencia: C$36.50 por US$1.
- Tasa editable por cada gimnasio.
- Auditoría de cambios importantes.

Fuera del MVP:

- Aplicación móvil nativa.
- Rutinas y nutrición.
- Portal o acceso del entrenador.
- Nómina y contabilidad completa.
- Inventario avanzado.
- Control físico de puertas.
- Funciones para grandes cadenas.

El portal del miembro todavía requiere decisión del dueño del producto. No implementarlo sin aprobación explícita.

## Reglas monetarias

- Soportar USD y NIO.
- Guardar monto, moneda y tasa aplicada en cada transacción.
- Nunca usar `float` o `double` para dinero; usar tipos decimales apropiados.
- Cambiar la tasa afecta solamente transacciones nuevas.
- Una transacción histórica nunca se recalcula con una tasa nueva.
- Los pagos no se eliminan: se anulan o corrigen mediante operaciones auditadas.
- Cada gimnasio controla su propia tasa.

## Tecnología decidida

- Aplicación: ASP.NET Core MVC.
- Interfaz: Razor Views y Bootstrap.
- Base de datos: PostgreSQL administrado por Supabase.
- Acceso a datos: Entity Framework Core con proveedor PostgreSQL.
- Autenticación: Supabase Auth, integrada y validada desde ASP.NET Core.
- Imágenes y archivos: Supabase Storage.
- Idioma de la interfaz: español.
- Hosting de ASP.NET Core: pendiente de seleccionar; será separado de Supabase.

SQL Server y Somee ya no son la arquitectura principal. No introducirlos sin una nueva decisión explícita.

## Arquitectura obligatoria

- El sistema es multi-tenant desde el comienzo.
- Toda entidad comercial debe pertenecer a un gimnasio mediante `GymId` o equivalente.
- Toda consulta y operación debe validar el gimnasio activo en el servidor.
- Ocultar botones no sustituye autorización.
- Ningún usuario de un gimnasio puede consultar o modificar datos de otro.
- El administrador de plataforma tendrá acceso especial, limitado y auditado.
- Separar reglas del negocio, persistencia y presentación para permitir pruebas.
- Mantener migraciones de base de datos versionadas en el repositorio.

## Roles iniciales

- Dueño: control total de su gimnasio, configuración, personal y reportes.
- Gerente: operaciones y reportes permitidos, sin propiedad de la cuenta.
- Recepcionista: miembros, membresías, cobros y entradas; acceso financiero limitado.
- Administrador de plataforma: gestión del SaaS, soporte y auditoría.

Crear una matriz explícita de permisos antes de implementar autorización.

## Seguridad mínima

- Validar autorización en cada operación del servidor.
- Proteger contra CSRF, XSS, inyección y carga de archivos peligrosos.
- No guardar secretos, contraseñas ni cadenas de conexión en Git.
- Usar variables de entorno o un administrador de secretos.
- Registrar acciones críticas sin almacenar contraseñas ni datos sensibles innecesarios.
- Usar HTTPS en cualquier ambiente con datos reales.
- Preparar y probar respaldo y restauración antes del piloto.

## Forma de trabajo

El trabajo alterna dos funciones:

### Producto y Vibe Coder

- Diseñar flujos, pantallas, estados y textos en español.
- Crear prototipos rápidos con datos falsos.
- Probar facilidad de uso con dueños y recepcionistas.
- No decidir por sí solo seguridad, permisos, dinero o estructura de datos.

### Full-Stack Developer

- Aprobar arquitectura y modelo de datos.
- Implementar reglas, seguridad, permisos, migraciones y pruebas.
- Revisar toda operación relacionada con dinero o aislamiento multi-tenant.
- Preparar despliegues, monitoreo, respaldo y restauración.

Orden normal:

1. Producto define y valida el flujo.
2. Vibe Coder crea el prototipo.
3. Full-Stack revisa riesgos y contratos de datos.
4. Full-Stack implementa y prueba.
5. Producto prueba con usuarios.
6. Se corrige antes de mover la tarea a terminado.

## Reglas para agentes Codex

- Leer este archivo y `TRELLO.md` antes de proponer o implementar trabajo.
- Trabajar una tarjeta claramente definida a la vez.
- No ampliar el MVP silenciosamente.
- Pedir una sola decisión a la vez cuando falte información del producto.
- Usar español simple y respuestas concisas con el dueño del producto.
- No afirmar que algo fue probado si no se ejecutó una verificación concreta.
- No cambiar decisiones técnicas establecidas sin explicar el motivo y recibir aprobación.
- No incluir credenciales en mensajes, archivos versionados, ejemplos ni logs.
- Agregar pruebas proporcionales al riesgo de cada cambio.
- Preservar cambios existentes que no pertenezcan a la tarea actual.

## Criterio general de terminado

Una función está terminada cuando:

- Cumple criterios funcionales claros.
- Respeta separación entre gimnasios y permisos.
- Maneja estados de éxito, vacío, validación y error.
- Tiene pruebas para reglas críticas.
- Fue verificada en un recorrido realista.
- No expone secretos ni datos de otro gimnasio.
- La documentación afectada fue actualizada.

## Prioridad inmediata

Antes de desarrollar todo el sistema:

1. Entrevistar al menos 10 dueños o gerentes.
2. Confirmar el dolor principal.
3. Cerrar reglas de membresías, pagos y entradas.
4. Decidir si el miembro tendrá acceso propio en el MVP.
5. Elegir hosting para ASP.NET Core.
6. Crear el primer flujo vertical: registrar miembro, cobrar membresía y registrar entrada.

## Referencia de planificación

El backlog detallado está en `TRELLO.md`. Este archivo gobierna el propósito, las decisiones técnicas y las reglas de ejecución; `TRELLO.md` gobierna las tareas y su orden.
