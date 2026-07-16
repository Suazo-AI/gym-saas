# AGENTS.md - FitManager / Gym SaaS

## Preflight obligatorio

Antes de analizar, planificar, editar archivos, ejecutar migraciones o escribir código, el agente debe:

1. Leer completamente este `AGENTS.md`.
2. Identificar la tarjeta concreta del tablero de Trello que se trabajará.
3. Revisar su descripción, responsable, etiquetas, checklist, dependencias y criterio de terminado.
4. Confirmar que la tarjeta está dentro del MVP y no contradice una decisión de este archivo.
5. Revisar el estado actual del repositorio y preservar cambios ajenos.
6. Revisar las migraciones existentes cuando la tarea afecte Supabase.
7. No comenzar una implementación si falta una decisión que afecte dinero, seguridad, permisos, multi-tenancy, biometría o alcance.

El tablero de Trello gobierna:

* las tareas;
* los responsables;
* las prioridades;
* los bloqueos;
* el estado del trabajo;
* los checklists;
* el orden de ejecución.

Este `AGENTS.md` gobierna:

* las reglas del producto;
* la arquitectura;
* la seguridad;
* el alcance del MVP;
* las decisiones técnicas;
* los criterios generales de implementación.

Si una tarjeta de Trello contradice este archivo, el trabajo debe detenerse y la discrepancia debe informarse antes de continuar.

El archivo utilizado originalmente para preparar el tablero de Trello es solamente una referencia de planificación. No representa automáticamente el estado actual de las tarjetas ni debe utilizarse como sustituto del tablero real.

## Objetivo del producto

Construir un SaaS multi-tenant para administrar gimnasios pequeños de Nicaragua.

La primera versión debe resolver el trabajo diario de recepción y permitir que el dueño controle:

* miembros;
* membresías;
* cargos;
* pagos;
* morosidad;
* entradas;
* personal;
* permisos;
* ingresos;
* alertas;
* estado general del gimnasio.

El producto comenzará dirigido a gimnasios de aproximadamente 25 a 100 miembros.

## Usuarios iniciales

* Dueño del gimnasio.
* Gerente.
* Recepcionista.
* Administrador interno de la plataforma SaaS.

La hipótesis principal es que los gimnasios pierden tiempo y control al manejar pagos, vencimientos y miembros mediante papel, Excel y WhatsApp.

Esta hipótesis debe validarse con al menos 10 dueños o gerentes. No debe tratarse como confirmada antes de completar las entrevistas.

## Alcance del MVP

Incluir:

* registro y configuración de gimnasios;
* sucursales;
* separación estricta de datos entre gimnasios;
* usuarios del gimnasio;
* roles y permisos;
* registro y búsqueda de miembros;
* planes de membresía;
* suscripciones de miembros;
* cargos de membresía;
* pagos y aplicación de pagos;
* estados de cuenta y morosidad;
* cancelación de membresías;
* entradas al gimnasio;
* alertas;
* dashboard;
* módulo simple de ingresos;
* auditoría;
* operación en USD y NIO;
* archivos y fotografías mediante Supabase Storage;
* borrado lógico para entidades administrativas.

El esquema ya contiene soporte para reconocimiento facial, consentimiento biométrico, embeddings, dispositivos y eventos de acceso. Esto no obliga a implementar todo el reconocimiento facial en el primer flujo vertical.

Fuera del MVP:

* aplicación móvil nativa;
* rutinas;
* nutrición;
* nómina;
* contabilidad completa;
* inventario avanzado;
* control físico automático de puertas;
* funciones para grandes cadenas;
* portal del entrenador;
* funcionalidades que no estén respaldadas por una tarjeta aprobada.

El acceso propio del miembro sigue pendiente de decisión. No implementarlo sin aprobación explícita.

## Stack tecnológico actual

### Frontend

* Next.js con App Router.
* TypeScript y TSX.
* React.
* Tailwind CSS.
* Despliegue inicial en Vercel.

### Backend y datos

* Supabase como backend principal.
* PostgreSQL administrado por Supabase.
* Supabase Auth.
* Supabase Storage.
* Row Level Security.
* Funciones PostgreSQL y RPC.
* Triggers.
* Vistas con `security_invoker`.
* Edge Functions o funciones de servidor confiables para procesos privilegiados.
* Extensión `pgvector` para embeddings faciales.

ASP.NET Core y Entity Framework Core no forman parte de la arquitectura actual.

No introducir ASP.NET Core, Entity Framework, SQL Server, Somee ni otro backend principal sin una decisión explícita.

## Estado actual de Supabase

La base de datos actual fue creada mediante estos scripts:

1. `gym_saas_supabase_schema.sql`
2. `gym_saas_storage_only_migration.sql`
3. `gym_saas_soft_delete_migration.sql`

Estos scripts ya fueron ejecutados en el proyecto remoto de Supabase.

Deben conservarse también como migraciones versionadas dentro del repositorio, preferiblemente en:

```text
supabase/
  migrations/
```

Ejemplo:

```text
supabase/migrations/
  20260716010000_initial_schema.sql
  20260716010100_storage_only.sql
  20260716010200_soft_delete.sql
```

No volver a ejecutar el esquema inicial completo sobre producción.

Todo cambio futuro debe hacerse mediante una migración incremental nueva.

No modificar producción únicamente desde SQL Editor sin guardar el mismo cambio como migración en el repositorio.

## Supabase como límite de seguridad

Supabase no debe tratarse únicamente como una base de datos.

Las siguientes capas forman parte de la seguridad del sistema:

* Supabase Auth;
* RLS;
* políticas de Storage;
* permisos de PostgreSQL;
* funciones privadas;
* funciones RPC;
* validaciones y restricciones;
* código de servidor;
* auditoría.

Ocultar botones en el frontend no sustituye autorización.

El frontend nunca debe ser considerado una fuente confiable para:

* `gym_id`;
* precios;
* totales;
* monedas;
* permisos;
* estados de pago;
* membresías activas;
* decisiones de acceso;
* identificadores de usuario;
* rutas de archivos.

## Multi-tenancy obligatorio

El sistema es multi-tenant desde el inicio.

Toda entidad comercial debe pertenecer a un gimnasio mediante `gym_id` o mediante una relación verificable con una entidad que lo posea.

Toda consulta debe respetar el gimnasio activo.

Toda inserción, actualización, RPC o eliminación lógica debe validar:

* usuario autenticado;
* gimnasio activo;
* pertenencia del usuario al gimnasio;
* estado del usuario del gimnasio;
* permiso requerido;
* estado lógico de la entidad.

Ningún usuario puede leer o modificar datos de otro gimnasio.

No confiar solamente en filtros enviados desde Next.js.

El aislamiento debe mantenerse mediante RLS, funciones seguras y validaciones de servidor.

Las operaciones con `service_role` deben validar manualmente el `gym_id`, porque `service_role` puede omitir RLS.

## Autenticación

La autenticación se realiza con Supabase Auth.

Las contraseñas pertenecen exclusivamente a Supabase Auth.

No crear tablas propias para guardar contraseñas.

El esquema relaciona usuarios autenticados mediante `auth.users`.

La creación de un usuario puede generar automáticamente:

* una persona;
* un perfil de usuario;
* información de contacto inicial.

El código de aplicación debe manejar correctamente:

* registro;
* inicio de sesión;
* cierre de sesión;
* recuperación de contraseña;
* verificación de sesión;
* expiración de sesión;
* usuarios invitados;
* usuarios suspendidos;
* usuarios revocados.

Las páginas protegidas deben validar la sesión en el servidor cuando sea posible.

## Claves de Supabase

La clave pública o `anon key` puede utilizarse en el cliente.

La clave `service_role`:

* nunca debe enviarse al navegador;
* nunca debe incluirse en variables `NEXT_PUBLIC_*`;
* nunca debe escribirse en Git;
* nunca debe aparecer en logs;
* nunca debe incluirse en ejemplos;
* solamente puede utilizarse en un entorno confiable.

Los secretos deben almacenarse en variables de entorno de Vercel, Supabase o el entorno de despliegue correspondiente.

## Acceso a datos desde Next.js

El acceso normal a datos debe hacerse con el cliente oficial de Supabase.

Separar claramente:

* cliente Supabase para navegador;
* cliente Supabase para servidor;
* operaciones privilegiadas;
* funciones de dominio;
* validación de datos;
* componentes de interfaz.

No colocar reglas críticas directamente dentro de componentes React.

Para operaciones simples puede utilizarse Supabase directamente bajo RLS.

Para operaciones complejas o sensibles se deben utilizar:

* funciones RPC;
* Route Handlers;
* Server Actions;
* Edge Functions;
* funciones de servidor confiables.

Las operaciones relacionadas con dinero, cancelaciones, permisos, biometría o eliminación deben ser atómicas.

## RLS y permisos

RLS es la principal frontera de autorización de los datos accesibles mediante Supabase.

Toda tabla expuesta a usuarios autenticados debe tener políticas revisadas.

Las políticas deben utilizar funciones existentes como:

* `private.is_gym_user(...)`;
* `private.has_permission(...)`;
* `private.can_access_person(...)`;
* `private.is_service_role()`.

No crear políticas basadas únicamente en valores enviados por el cliente.

Antes de agregar una tabla nueva, definir:

1. quién puede leerla;
2. quién puede crear registros;
3. quién puede modificarlos;
4. si puede eliminarse;
5. qué permiso se necesita;
6. cómo se determina el gimnasio;
7. qué sucede con registros históricos.

Toda política nueva debe probarse con al menos:

* un usuario autorizado;
* un usuario sin permiso;
* un usuario de otro gimnasio;
* un usuario no autenticado.

## Roles y permisos

El esquema incluye:

* pantallas;
* permisos;
* relación entre pantallas y permisos;
* usuarios de gimnasio;
* roles;
* permisos por rol;
* roles asignados a usuarios.

Roles iniciales:

### Dueño

Control total de su gimnasio, configuración, personal, membresías, pagos, ingresos, auditoría y reportes.

### Gerente

Operación y reportes autorizados, sin propiedad de la cuenta SaaS.

### Recepcionista

Miembros, membresías, cobros y entradas, con acceso financiero limitado.

### Administrador de plataforma

Gestión interna del SaaS, soporte y auditoría. Sus operaciones especiales deben quedar registradas.

No asignar permisos basándose solamente en el nombre del rol.

La autorización debe usar códigos de permisos.

No modificar los códigos de permisos existentes sin una migración y revisión del frontend.

## Dinero y monedas

Nunca utilizar `float`, `double` ni números de punto flotante para dinero.

En PostgreSQL utilizar `numeric` con precisión adecuada.

En TypeScript evitar cálculos monetarios críticos mediante `number` sin una estrategia segura.

Los registros financieros deben guardar como mínimo:

* monto;
* moneda;
* fecha;
* estado;
* gimnasio;
* usuario responsable cuando corresponda.

El esquema actual registra montos y monedas de forma separada.

Antes de implementar conversiones automáticas entre USD y NIO debe cerrarse y migrarse la regla de tasa de cambio por gimnasio.

No asumir que una tasa configurada actualmente existe si todavía no está representada en las tablas.

Cuando se implemente la tasa de cambio:

* cada gimnasio tendrá su propia tasa;
* la tasa inicial de referencia será C$36.50 por US$1;
* la tasa aplicada debe guardarse en cada transacción convertida;
* cambiar la tasa solo afectará transacciones nuevas;
* las transacciones históricas no se recalcularán.

## Pagos, cargos y suscripciones

Existen dos niveles diferentes de facturación:

### Facturación del SaaS

* planes SaaS;
* suscripción del gimnasio;
* facturas SaaS;
* pagos SaaS;
* aplicación de pagos;
* cancelación de suscripción.

### Facturación de miembros

* planes de membresía;
* suscripciones de miembros;
* cargos;
* pagos de miembros;
* aplicación de pagos;
* cancelación de membresía.

No mezclar ambos niveles.

Un pago no debe eliminarse físicamente.

Los pagos deben:

* anularse;
* reembolsarse;
* corregirse mediante una operación auditada;
* conservar su historial.

No confiar en montos totales calculados por el navegador.

La creación de cargos, aplicación de pagos y cancelación de suscripciones debe ejecutarse mediante operaciones atómicas.

Usar las RPC existentes cuando corresponda, por ejemplo:

* `generate_membership_charges`;
* `cancel_member_subscription`;
* `request_saas_subscription_cancellation`.

## Borrado lógico

El borrado lógico solamente se aplica a entidades administrativas o CRUD.

Entre las entidades con borrado lógico se encuentran:

* gimnasios;
* sucursales;
* usuarios de gimnasio;
* roles;
* miembros;
* planes de membresía;
* beneficios de planes;
* archivos;
* fotografías;
* dispositivos de acceso;
* categorías de ingreso.

No actualizar directamente:

* `deleted_at`;
* `deleted_by`;
* `deletion_reason`.

Utilizar las RPC diseñadas para ello:

* `soft_delete_entity`;
* `restore_entity`;
* `archive_gym`;
* `restore_gym`;
* `list_deleted_entities`.

No ejecutar `DELETE` físico desde el frontend.

Los registros financieros e históricos no utilizan borrado lógico.

No borrar:

* facturas;
* pagos;
* cargos;
* suscripciones;
* ingresos;
* eventos de acceso;
* alertas;
* auditorías.

Estos registros deben manejarse mediante sus estados de ciclo de vida.

## Supabase Storage

Los archivos reales se almacenan en Supabase Storage.

La tabla `media_assets` almacena únicamente metadatos y referencias.

No guardar imágenes como:

* `bytea`;
* Base64;
* cadenas dentro de JSON;
* columnas binarias.

El bucket actual es:

```text
gym-media
```

El bucket es privado.

La ruta debe comenzar con el identificador del gimnasio:

```text
<gym_id>/<person_id-o-general>/<uuid>.<extension>
```

Ejemplo:

```text
9fd6.../members/4c71.../photo.webp
```

El primer segmento de la ruta debe coincidir con el `gym_id` del registro.

Formatos permitidos actualmente:

* WebP;
* AVIF;
* JPEG;
* PNG;
* PDF.

Límite actual por archivo:

```text
10 MB
```

Las imágenes deben comprimirse antes de almacenarse.

Preferir WebP o AVIF para fotografías.

No permitir que el usuario controle libremente el nombre final del objeto.

Generar nombres únicos.

Validar:

* MIME real;
* extensión;
* tamaño;
* permisos;
* gimnasio;
* propósito;
* ruta;
* duplicados cuando corresponda.

## Eliminación de archivos

Eliminar el registro de PostgreSQL no elimina automáticamente el objeto de Storage.

El esquema incluye `storage_deletion_queue`.

El flujo correcto es:

1. solicitar el borrado lógico;
2. crear o procesar el trabajo de eliminación;
3. una Edge Function o worker confiable reclama el trabajo;
4. el worker elimina el objeto usando la API de Supabase Storage;
5. el worker marca el trabajo como completado o fallido.

Las RPC de la cola requieren `service_role`.

No modificar ni eliminar directamente registros de `storage.objects`.

## Reconocimiento facial

El esquema incluye:

* fotografías de personas;
* consentimiento biométrico;
* modelos faciales;
* embeddings;
* eventos de reconocimiento;
* dispositivos;
* alertas;
* búsqueda por similitud con `pgvector`.

Los embeddings actuales utilizan vectores de 512 dimensiones.

No cambiar la dimensión sin una migración completa y una decisión sobre el modelo facial.

Antes de crear un embedding debe existir consentimiento biométrico válido.

El consentimiento debe poder:

* otorgarse;
* revocarse;
* expirar;
* definir retención.

La fotografía original se almacena en Supabase Storage.

El embedding se almacena en PostgreSQL.

La generación del embedding debe ejecutarse en:

* Edge Function;
* servicio Python confiable;
* servidor seguro.

Nunca generar o validar decisiones críticas únicamente en el navegador.

El flujo recomendado es:

1. capturar o subir fotografía;
2. comprimirla;
3. guardarla en Storage;
4. registrar metadatos;
5. verificar consentimiento;
6. generar embedding en un servicio confiable;
7. guardar embedding;
8. ejecutar `match_face_candidates`;
9. validar membresía y morosidad;
10. registrar el evento;
11. generar alerta cuando corresponda.

No utilizar reconocimiento facial como única evidencia irreversible de identidad.

Debe existir revisión manual para casos dudosos.

## Auditoría

Registrar acciones críticas como:

* cambios de roles;
* cambios de permisos;
* creación o suspensión de usuarios;
* pagos;
* anulaciones;
* cancelaciones;
* cambios de membresía;
* borrado lógico;
* restauraciones;
* archivado de gimnasios;
* cambios de configuración;
* operaciones biométricas;
* acceso administrativo de plataforma.

No guardar en auditoría:

* contraseñas;
* tokens;
* claves;
* imágenes completas;
* embeddings completos;
* información sensible innecesaria.

No afirmar que una acción fue auditada sin verificar que realmente se creó el registro.

## Migraciones

Toda modificación de base de datos debe tener una migración nueva.

Una migración debe incluir, cuando corresponda:

* cambios de tablas;
* índices;
* restricciones;
* funciones;
* triggers;
* políticas RLS;
* grants;
* vistas;
* comentarios;
* rollback documentado cuando sea viable;
* pruebas o consultas de verificación.

No editar una migración que ya fue aplicada en producción para cambiar su comportamiento.

Crear una migración incremental.

Antes de aplicar una migración:

1. revisar dependencias;
2. revisar datos existentes;
3. verificar si es destructiva;
4. crear respaldo cuando exista riesgo;
5. probar en ambiente local o de desarrollo;
6. revisar RLS;
7. revisar permisos;
8. verificar que no exponga datos entre gimnasios.

Después de aplicarla:

1. ejecutar consultas de validación;
2. verificar funciones;
3. verificar políticas;
4. probar con usuarios de diferentes gimnasios;
5. actualizar documentación;
6. registrar el resultado en la tarjeta correspondiente.

## Uso de Supabase SQL Editor

SQL Editor puede utilizarse para:

* consultas de diagnóstico;
* verificaciones;
* pruebas controladas;
* aplicar una migración aprobada.

No debe utilizarse como único historial de cambios.

Todo SQL aplicado manualmente debe copiarse inmediatamente a una migración versionada.

Nunca pegar y ejecutar código destructivo en producción sin revisar primero:

* proyecto seleccionado;
* rama;
* entorno;
* transacción;
* tablas afectadas;
* respaldo;
* impacto multi-tenant.

## Desarrollo del frontend

El frontend debe construirse a partir de contratos reales de Supabase.

Antes de crear una pantalla:

1. identificar tablas, vistas o RPC necesarias;
2. identificar permisos;
3. identificar estados;
4. revisar RLS;
5. definir validaciones;
6. definir estados vacíos;
7. definir errores;
8. definir carga;
9. definir actualización;
10. definir comportamiento sin conexión cuando corresponda.

No inventar campos que no existan en el esquema.

No consultar directamente tablas históricas complejas cuando exista una vista o RPC preparada.

Las vistas actuales deben aprovecharse para:

* estado de acceso del miembro;
* ingresos;
* ingresos diarios;
* dashboard.

## Validación de datos

Validar datos en más de una capa cuando el riesgo lo justifique:

* formulario;
* esquema Zod;
* código de servidor;
* restricción PostgreSQL;
* RLS;
* RPC.

La validación del cliente mejora la experiencia, pero no protege el sistema.

Las reglas críticas deben existir en PostgreSQL o en una función confiable.

## Seguridad mínima

* HTTPS en entornos reales.
* RLS en tablas expuestas.
* Storage privado.
* Protección contra XSS.
* Protección contra CSRF donde aplique.
* Validación de archivos.
* Validación de entrada.
* Variables de entorno.
* Rotación de secretos comprometidos.
* Dependencias actualizadas.
* Logs sin credenciales.
* Backups verificados.
* Restauración probada antes del piloto.
* Rate limiting para operaciones sensibles.
* Protección especial para autenticación y reconocimiento facial.

## Realtime

No utilizar Supabase Realtime de forma automática en todos los módulos.

Usarlo solamente cuando exista una necesidad concreta, como:

* alertas;
* accesos recientes;
* actualización de recepción;
* cambios de estado relevantes.

Toda suscripción Realtime debe respetar RLS y limpiarse correctamente al desmontar componentes.

## Edge Functions

Usar Edge Functions o un servicio confiable para:

* operaciones con `service_role`;
* procesamiento de imágenes;
* generación de embeddings;
* integración con correo;
* webhooks;
* tareas programadas;
* eliminación física de Storage;
* procesamiento de pagos externos;
* operaciones que requieran secretos.

No usar Edge Functions como reemplazo innecesario de todas las operaciones CRUD.

Las operaciones normales pueden ejecutarse mediante Supabase y RLS.

## Pruebas

Agregar pruebas proporcionales al riesgo.

### Riesgo bajo

* componentes visuales;
* textos;
* estados vacíos.

### Riesgo medio

* formularios;
* filtros;
* búsqueda;
* carga de archivos;
* CRUD administrativo.

### Riesgo alto

* pagos;
* membresías;
* cancelaciones;
* roles;
* permisos;
* RLS;
* multi-tenancy;
* biometría;
* service role;
* eliminación;
* migraciones.

Las pruebas de multi-tenancy deben intentar explícitamente acceder a datos de otro gimnasio.

No afirmar que algo fue probado si no se ejecutó una verificación concreta.

## Forma de trabajo

El trabajo alterna dos funciones.

### Producto y Vibe Coder

* diseña flujos;
* diseña pantallas;
* define estados;
* escribe textos en español;
* crea prototipos;
* usa datos falsos;
* valida facilidad de uso.

No decide por sí solo:

* seguridad;
* permisos;
* dinero;
* migraciones;
* RLS;
* biometría;
* estructura de datos.

### Full-Stack Developer

* revisa arquitectura;
* revisa esquema;
* implementa contratos de datos;
* implementa RLS;
* implementa funciones;
* implementa migraciones;
* revisa seguridad;
* agrega pruebas;
* revisa operaciones monetarias;
* protege el aislamiento multi-tenant;
* prepara despliegue y monitoreo.

Orden normal:

1. Producto define el flujo.
2. Se valida la necesidad.
3. Vibe Coder crea el prototipo.
4. Full-Stack revisa esquema, permisos y riesgos.
5. Se crean migraciones o RPC si hacen falta.
6. Se implementa el frontend.
7. Se ejecutan pruebas.
8. Producto prueba con usuarios.
9. Se corrigen problemas.
10. La tarjeta pasa a terminado.

## Reglas para agentes Codex

* Leer `AGENTS.md` y `TRELLO.md`.
* Trabajar una tarjeta a la vez.
* No ampliar el MVP silenciosamente.
* No cambiar la arquitectura Supabase-first.
* No introducir otro backend sin aprobación.
* No inventar tablas o endpoints.
* Revisar migraciones antes de modificar datos.
* No editar producción sin una migración versionada.
* No exponer `service_role`.
* No omitir RLS.
* No usar `DELETE` físico desde la aplicación.
* No modificar datos históricos para ocultar errores.
* No incluir secretos.
* No afirmar que algo fue probado sin ejecutar la prueba.
* No sobrescribir cambios ajenos.
* Usar español simple y respuestas concisas.
* Informar brechas reales entre frontend, migraciones y producto.
* Detener la implementación cuando falte una decisión crítica de dinero, seguridad, permisos o biometría.

## Criterio general de terminado

Una función está terminada cuando:

* cumple criterios funcionales claros;
* pertenece al MVP;
* respeta aislamiento entre gimnasios;
* respeta permisos;
* maneja carga, éxito, vacío, validación y error;
* tiene pruebas proporcionales al riesgo;
* fue verificada con un recorrido realista;
* no expone secretos;
* no permite acceso a otro gimnasio;
* actualiza la documentación;
* incluye migración cuando modifica Supabase;
* revisa RLS;
* no rompe datos históricos;
* no deja trabajos de Storage sin procesar;
* no depende solamente de validación del frontend.

## Prioridad inmediata

Antes de desarrollar todo el sistema:

1. Entrevistar al menos 10 dueños o gerentes.
2. Confirmar el dolor principal.
3. Cerrar reglas de membresías.
4. Cerrar reglas de cargos y pagos.
5. Definir la tasa de cambio USD/NIO y crear la migración correspondiente.
6. Decidir si el miembro tendrá acceso propio.
7. Versionar correctamente las tres migraciones ya aplicadas.
8. Configurar el proyecto Next.js con Supabase Auth.
9. Crear la matriz inicial de roles y permisos.
10. Implementar el primer flujo vertical:

    * registrar miembro;
    * asignar membresía;
    * generar cargo;
    * registrar pago;
    * consultar estado;
    * registrar entrada.
11. Probar el flujo con dos gimnasios diferentes.
12. Confirmar que ningún usuario puede acceder a los datos del otro gimnasio.

El reconocimiento facial debe implementarse después de que el flujo básico de miembros, membresías, pagos y entradas funcione correctamente.

## Referencia de planificación

El tablero real de Trello es la fuente de verdad para el trabajo operativo del equipo.

Cada tarjeta debe indicar:

* resultado esperado;
* responsable;
* etiquetas;
* checklist;
* dependencias;
* criterio de terminado;
* estado actual.

El archivo Markdown utilizado para diseñar inicialmente el tablero solamente sirve como plantilla o respaldo. No determina qué tareas están asignadas, iniciadas, bloqueadas o terminadas.

Los agentes deben recibir o identificar una tarjeta concreta antes de implementar cambios.
