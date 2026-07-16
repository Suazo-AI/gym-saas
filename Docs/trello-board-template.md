# Plantilla para crear el tablero de Trello - FitManager

> Este documento sirve para crear o reconstruir el tablero de Trello del equipo.
> No representa el estado actual del proyecto, no sustituye al tablero real y no asigna automáticamente trabajo a ningún agente.
>
> Una vez creado el tablero, Trello será la fuente de verdad para responsables, prioridades, bloqueos, fechas y estado de cada tarjeta.

## Reglas del tablero

- Producto: SaaS multi-tenant para administrar gimnasios pequeños de Nicaragua, inicialmente de 25 a 100 miembros.
- Interfaz: español.
- Monedas: USD y NIO.
- Tasa inicial de referencia: C$36.50 por US$1.
- Cada gimnasio podrá configurar su propia tasa.
- Los cambios de tasa afectarán solamente transacciones nuevas y deberán quedar auditados.
- Roles iniciales: Dueño, Gerente, Recepcionista y Administrador de plataforma.
- Frontend: Next.js con App Router, TypeScript, TSX y Tailwind CSS.
- Backend principal: Supabase.
- Base de datos: PostgreSQL administrado por Supabase.
- Autenticación: Supabase Auth.
- Archivos e imágenes: Supabase Storage privado.
- Autorización de datos: Row Level Security, permisos y funciones seguras.
- Operaciones complejas: funciones PostgreSQL, RPC, Server Actions, Route Handlers o Edge Functions según el riesgo.
- Despliegue inicial: Vercel para Next.js y Supabase para backend, base de datos, autenticación y Storage.
- No usar ASP.NET Core, Entity Framework, SQL Server, Somee ni Bootstrap como arquitectura principal sin una nueva decisión explícita.
- El Full-Stack revisa y aprueba cambios relacionados con seguridad, permisos, dinero, multi-tenancy, migraciones, biometría y despliegues.
- Cada tarjeta debe producir un resultado verificable, no solamente “avanzar” o “trabajar” en un módulo.

## Forma de usar esta plantilla

1. Crear en Trello las listas descritas en este documento.
2. Crear una tarjeta por cada título de tercer nivel.
3. Copiar responsable, etiquetas, checklist y criterio de terminado dentro de la tarjeta.
4. Asignar personas reales y fechas directamente en Trello.
5. Dividir una tarjeta si requiere varios responsables trabajando de forma independiente.
6. Mover las tarjetas según su estado real.
7. No usar este archivo para determinar si una tarea está pendiente, iniciada, bloqueada o terminada.

## Etiquetas

- `PRODUCTO` - decisiones, entrevistas y validación del negocio.
- `VIBE` - experiencia, prototipos, pantallas y textos.
- `FRONTEND` - Next.js, componentes, formularios y navegación.
- `SUPABASE` - PostgreSQL, Auth, Storage, RLS, funciones y migraciones.
- `FULLSTACK` - integración, reglas de negocio y flujos completos.
- `SEGURIDAD` - autenticación, autorización, multi-tenancy, biometría y auditoría.
- `QA` - pruebas y verificaciones.
- `DEVOPS` - ambientes, despliegue, monitoreo, respaldo y restauración.
- `MVP` - obligatorio para el piloto.
- `DESPUÉS` - fuera de la primera versión.
- `BLOQUEADO` - necesita una decisión o dependencia.

## Lista: 00 - Decisiones pendientes

### Entrevistar 10 dueños o gerentes de gimnasio

- Responsable: Producto.
- Etiquetas: `PRODUCTO`, `MVP`.
- Checklist:
  - Crear una lista de al menos 30 gimnasios.
  - Contactar al menos 20.
  - Entrevistar al menos 10 dueños o gerentes.
  - Registrar procesos actuales, dolores y palabras utilizadas por los entrevistados.
  - Confirmar si el problema principal es el control de pagos, vencimientos y miembros activos.
  - Registrar objeciones al uso de un sistema digital.
- Terminado cuando: existen notas comparables de 10 entrevistas y un resumen de patrones encontrados.

### Definir acceso propio del miembro

- Responsable: Producto.
- Etiquetas: `PRODUCTO`, `BLOQUEADO`.
- Decisión: confirmar si el miembro tendrá una cuenta propia en el MVP.
- Recomendación inicial: no incluir portal del miembro en el primer piloto.
- Terminado cuando: la decisión está documentada y el alcance del MVP fue actualizado.

### Definir reglas de membresía

- Responsable: Producto + Full-Stack.
- Etiquetas: `PRODUCTO`, `FULLSTACK`, `MVP`.
- Checklist:
  - Plan mensual inicial.
  - Fecha de inicio y vencimiento.
  - Días de gracia.
  - Renovación manual o automática.
  - Congelamiento.
  - Cancelación.
  - Reactivación.
  - Descuentos.
  - Pagos parciales.
  - Cambio de plan.
  - Tratamiento de saldos pendientes.
- Terminado cuando: cada estado y transición está escrito sin ambigüedad.

### Definir reglas de pagos y cargos

- Responsable: Producto + Full-Stack.
- Etiquetas: `PRODUCTO`, `FULLSTACK`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Determinar cuándo se genera un cargo.
  - Definir pagos completos y parciales.
  - Definir aplicación de un pago a uno o varios cargos.
  - Definir anulación y corrección.
  - Definir numeración de recibos.
  - Definir métodos de pago permitidos.
  - Definir tratamiento de pagos en USD y NIO.
- Terminado cuando: puede explicarse el ciclo completo desde el cargo hasta el recibo y la corrección.

### Definir tasa de cambio por gimnasio

- Responsable: Producto + Full-Stack.
- Etiquetas: `PRODUCTO`, `SUPABASE`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Confirmar tasa inicial de referencia.
  - Definir quién puede modificarla.
  - Definir fecha efectiva.
  - Guardar la tasa aplicada en cada transacción convertida.
  - Confirmar que las transacciones históricas no se recalculan.
  - Definir cómo se mostrará la conversión en recibos y reportes.
- Terminado cuando: existe una regla aprobada y una tarjeta técnica para implementarla mediante migración.

### Definir método de entrada

- Responsable: Producto.
- Etiquetas: `PRODUCTO`, `BLOQUEADO`.
- Decisión: búsqueda manual, código QR o ambos.
- Recomendación MVP: búsqueda rápida y QR opcional.
- Terminado cuando: se selecciona el método del piloto y se actualiza el flujo de recepción.

### Definir alcance del reconocimiento facial

- Responsable: Producto + Full-Stack.
- Etiquetas: `PRODUCTO`, `SEGURIDAD`, `BLOQUEADO`.
- Checklist:
  - Confirmar si se probará durante el piloto o después.
  - Definir consentimiento biométrico.
  - Definir revisión manual en coincidencias dudosas.
  - Definir retención y eliminación de fotografías y embeddings.
  - Definir qué decisión puede tomar el sistema automáticamente.
- Recomendación: implementar primero miembros, membresías, pagos y entradas sin depender del reconocimiento facial.
- Terminado cuando: el alcance biométrico y sus límites están aprobados.

### Definir precio del SaaS

- Responsable: Producto.
- Etiquetas: `PRODUCTO`.
- Checklist:
  - Precio piloto.
  - Precio mensual normal.
  - Prueba gratuita.
  - Límites por miembros o sucursales.
  - Método de cobro al gimnasio.
  - Política de cancelación.
- Terminado cuando: existe una propuesta que pueda presentarse a un gimnasio piloto.

## Lista: 01 - Descubrimiento

### Documentar el proceso actual del gimnasio

- Responsable: Producto.
- Etiquetas: `PRODUCTO`, `MVP`.
- Checklist:
  - Registrar miembro.
  - Cobrar membresía.
  - Confirmar entrada.
  - Detectar vencidos.
  - Revisar ingresos.
  - Abrir y cerrar caja si el gimnasio utiliza ese proceso.
  - Crear reporte mensual.
- Terminado cuando: existe un flujo actual con pasos, responsables, herramientas y problemas.

### Definir éxito del piloto

- Responsable: Producto.
- Etiquetas: `PRODUCTO`, `MVP`.
- Métricas sugeridas:
  - Un gimnasio usa el sistema diariamente durante 30 días.
  - Al menos 80% de las entradas se registran en el sistema.
  - Todos los pagos del periodo quedan registrados.
  - El dueño identifica morosos sin utilizar Excel.
  - La recepción completa registro, cobro y entrada sin ayuda técnica.
  - No ocurre pérdida ni mezcla de datos entre gimnasios.
- Terminado cuando: las métricas, responsables y forma de medición están aprobadas.

### Definir alcance cerrado del MVP

- Responsable: Producto + Full-Stack.
- Etiquetas: `PRODUCTO`, `FULLSTACK`, `MVP`.
- Incluye:
  - Gimnasios y sucursales.
  - Usuarios, roles y permisos.
  - Miembros.
  - Planes y membresías.
  - Cargos, pagos y recibos.
  - Morosidad.
  - Entradas.
  - Ingresos y caja básica si se confirma como necesaria.
  - Reportes esenciales.
  - USD y NIO.
  - Auditoría.
  - Fotografías mediante Supabase Storage.
- No incluye:
  - Aplicación móvil nativa.
  - Rutinas y nutrición.
  - Acceso para entrenadores.
  - Nómina.
  - Contabilidad completa.
  - Control físico automático de puertas.
  - Inventario avanzado.
  - Funciones para cadenas grandes.
- Terminado cuando: el alcance fue aprobado y las tarjetas fuera del MVP están etiquetadas como `DESPUÉS`.

## Lista: 02 - Diseño Producto y Vibe Coder

### Crear mapa de navegación

- Responsable: Vibe Coder.
- Etiquetas: `VIBE`, `MVP`.
- Secciones iniciales:
  - Inicio.
  - Miembros.
  - Membresías.
  - Pagos.
  - Entradas.
  - Ingresos o caja.
  - Reportes.
  - Personal.
  - Configuración.
- Terminado cuando: existe un mapa revisado por Producto y Full-Stack.

### Diseñar registro de miembro

- Responsable: Vibe Coder.
- Etiquetas: `VIBE`, `MVP`.
- Campos mínimos:
  - Nombres y apellidos.
  - Teléfono.
  - Identificación opcional.
  - Fecha de nacimiento opcional.
  - Contacto de emergencia opcional.
  - Foto opcional.
  - Plan y fecha de inicio.
- Estados:
  - Cargando.
  - Vacío.
  - Error.
  - Posible duplicado.
  - Éxito.
- Terminado cuando: el prototipo permite completar el flujo y contempla todos los estados.

### Diseñar cobro y recibo

- Responsable: Vibe Coder.
- Etiquetas: `VIBE`, `MVP`.
- Checklist:
  - Seleccionar miembro.
  - Mostrar deuda, estado y vencimiento.
  - Elegir USD o NIO.
  - Mostrar tasa aplicada cuando corresponda.
  - Seleccionar método de pago.
  - Permitir pago parcial si fue aprobado.
  - Confirmar pago.
  - Mostrar recibo.
  - Preparar impresión o descarga.
- Terminado cuando: Producto y Full-Stack aprueban el flujo y la información monetaria mostrada.

### Diseñar pantalla de entrada

- Responsable: Vibe Coder.
- Etiquetas: `VIBE`, `MVP`.
- Requisitos:
  - Uso rápido desde recepción.
  - Buscar por nombre, teléfono o código.
  - Mostrar estado activo, vencido, moroso o bloqueado.
  - Mostrar alerta clara sin exponer información innecesaria.
  - Registrar entrada con una acción.
- Terminado cuando: una recepcionista puede completar el flujo sin explicación adicional.

### Diseñar dashboard del dueño

- Responsable: Vibe Coder.
- Etiquetas: `VIBE`, `MVP`.
- Mostrar:
  - Miembros activos.
  - Membresías por vencer.
  - Morosos.
  - Ingresos del día y del mes.
  - Entradas del día.
  - Alertas importantes.
- Terminado cuando: las métricas tienen definición y fuente de datos identificadas.

### Diseñar gestión de personal y permisos

- Responsable: Vibe Coder + Full-Stack.
- Etiquetas: `VIBE`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Invitar usuario.
  - Asignar rol.
  - Ver permisos efectivos.
  - Suspender o reactivar acceso.
  - Mostrar límites del rol sin depender solamente de botones ocultos.
- Terminado cuando: la interfaz coincide con la matriz de permisos aprobada.

### Escribir textos en español

- Responsable: Vibe Coder.
- Etiquetas: `VIBE`, `MVP`.
- Regla: lenguaje corto, claro y consistente; evitar términos técnicos innecesarios.
- Terminado cuando: los flujos principales tienen títulos, ayudas, validaciones, errores y confirmaciones.

### Probar prototipo con usuarios

- Responsable: Vibe Coder + Producto.
- Etiquetas: `VIBE`, `QA`.
- Checklist:
  - Dos recepcionistas completan registro, cobro y entrada.
  - Dos dueños encuentran morosos e ingresos.
  - Registrar confusiones.
  - Registrar tiempo por tarea.
  - Priorizar correcciones antes del desarrollo final.
- Terminado cuando: existe un informe breve con problemas observados y cambios acordados.

## Lista: 03 - Base técnica Supabase y Next.js

### Crear aplicación Next.js

- Responsable: Frontend o Full-Stack.
- Etiquetas: `FRONTEND`, `FULLSTACK`, `MVP`.
- Checklist:
  - Next.js con App Router.
  - TypeScript y TSX.
  - Tailwind CSS.
  - Estructura por módulos o dominios.
  - Variables de entorno.
  - Manejo de errores.
  - Validación con Zod.
  - Separar componentes cliente y servidor.
- Terminado cuando: la aplicación ejecuta localmente, tiene una estructura acordada y no contiene secretos versionados.

### Configurar clientes de Supabase

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `FRONTEND`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Cliente para navegador.
  - Cliente para servidor.
  - Manejo de cookies y sesión.
  - Variables públicas separadas de secretos.
  - Confirmar que `service_role` no llega al navegador.
- Terminado cuando: una ruta pública y una protegida funcionan correctamente.

### Versionar las migraciones existentes

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `FULLSTACK`, `MVP`.
- Checklist:
  - Guardar el esquema inicial en `supabase/migrations`.
  - Guardar la migración de Storage.
  - Guardar la migración de borrado lógico.
  - Ordenar nombres por fecha.
  - Documentar cuáles ya fueron ejecutadas en el proyecto remoto.
  - No volver a ejecutar el esquema inicial completo en producción.
- Terminado cuando: las tres migraciones están versionadas y el estado remoto puede compararse con el repositorio.

### Preparar Supabase local o ambiente de desarrollo

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `DEVOPS`, `MVP`.
- Checklist:
  - Instalar y configurar Supabase CLI.
  - Crear configuración local o un proyecto separado de desarrollo.
  - Aplicar migraciones desde cero.
  - Crear datos semilla sin información real.
  - Documentar comandos de inicio, reinicio y migración.
- Terminado cuando: otro integrante puede levantar el entorno siguiendo la documentación.

### Revisar el esquema actual

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `FULLSTACK`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Verificar claves foráneas.
  - Verificar índices.
  - Verificar restricciones.
  - Verificar columnas `gym_id`.
  - Verificar borrado lógico.
  - Verificar estados financieros e históricos.
  - Detectar campos faltantes para el MVP.
  - Crear migraciones incrementales para correcciones.
- Terminado cuando: existe un informe corto de hallazgos y las correcciones necesarias están en tarjetas separadas.

### Diseñar contrato de acceso a datos

- Responsable: Full-Stack.
- Etiquetas: `FULLSTACK`, `SUPABASE`, `MVP`.
- Para cada operación definir:
  - Caso de uso.
  - Tabla o vista utilizada.
  - Si será CRUD directo, RPC, Server Action, Route Handler o Edge Function.
  - Entrada y salida.
  - Validaciones.
  - Permiso requerido.
  - Errores esperados.
  - Paginación, orden y filtros.
  - Efectos de auditoría.
- Prioridad inicial:
  - Registrar miembro.
  - Crear membresía.
  - Generar cargo.
  - Registrar y aplicar pago.
  - Consultar estado del miembro.
  - Registrar entrada.
- Terminado cuando: el frontend puede implementarse sin inventar campos ni reglas.

### Implementar autenticación con Supabase Auth

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `FRONTEND`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Registro o invitación según el flujo aprobado.
  - Inicio de sesión.
  - Cierre de sesión.
  - Recuperación de contraseña.
  - Verificación de sesión en servidor.
  - Protección de rutas.
  - Manejo de sesión expirada.
  - Usuarios suspendidos o revocados.
- Terminado cuando: los recorridos de autenticación fueron probados y las rutas privadas no cargan sin sesión válida.

### Implementar multi-tenancy con RLS

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `SEGURIDAD`, `MVP`.
- Requisitos:
  - Cada entidad comercial pertenece a un gimnasio.
  - Toda política valida el gimnasio del usuario autenticado.
  - Ningún filtro enviado por el cliente sustituye RLS.
  - Las operaciones con `service_role` validan manualmente el gimnasio.
  - El Administrador de plataforma opera mediante acceso especial y auditado.
- Pruebas mínimas:
  - Usuario autorizado.
  - Usuario sin permiso.
  - Usuario de otro gimnasio.
  - Usuario no autenticado.
- Terminado cuando: las pruebas demuestran que no existe lectura ni modificación cruzada entre gimnasios.

### Crear matriz de roles y permisos

- Responsable: Producto + Full-Stack.
- Etiquetas: `PRODUCTO`, `SUPABASE`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Listar pantallas y acciones.
  - Definir permisos por código.
  - Asignar permisos a Dueño.
  - Asignar permisos a Gerente.
  - Asignar permisos a Recepcionista.
  - Definir acceso del Administrador de plataforma.
  - Revisar acceso financiero y auditoría.
- Terminado cuando: la matriz está aprobada y puede transformarse en datos semilla o migración.

### Implementar roles y permisos

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Crear o revisar roles.
  - Crear o revisar permisos.
  - Asignar roles a usuarios del gimnasio.
  - Validar permisos mediante funciones seguras.
  - Aplicar permisos en RLS y operaciones sensibles.
  - Mostrar permisos efectivos en el frontend.
- Terminado cuando: cada rol puede completar únicamente las operaciones aprobadas.

### Configurar Supabase Storage

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Confirmar bucket privado `gym-media`.
  - Confirmar formatos permitidos.
  - Confirmar límite de 10 MB.
  - Definir rutas iniciando con `gym_id`.
  - Validar MIME, extensión y tamaño.
  - Generar nombres únicos.
  - Probar carga, lectura y eliminación autorizada.
  - Confirmar que un gimnasio no accede a archivos de otro.
- Terminado cuando: una fotografía de miembro puede cargarse y consultarse sin exposición pública ni acceso cruzado.

### Implementar cola de eliminación de Storage

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `DEVOPS`, `SEGURIDAD`.
- Checklist:
  - Revisar `storage_deletion_queue`.
  - Crear Edge Function o worker confiable.
  - Reclamar trabajos pendientes.
  - Eliminar objetos mediante la API de Storage.
  - Registrar éxito o error.
  - Evitar eliminar objetos desde el navegador.
- Terminado cuando: el borrado lógico genera un trabajo y el objeto puede eliminarse de forma segura.

### Revisar y documentar RPC existentes

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `FULLSTACK`, `MVP`.
- Checklist:
  - Listar funciones RPC disponibles.
  - Documentar parámetros y respuesta.
  - Documentar permisos.
  - Documentar errores.
  - Identificar cuáles usará el primer flujo vertical.
  - Crear migraciones para RPC faltantes.
- Terminado cuando: el contrato de datos referencia funciones reales y verificadas.

### Implementar auditoría

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `SEGURIDAD`, `MVP`.
- Auditar:
  - Tasas de cambio.
  - Pagos anulados o corregidos.
  - Cambios de membresía.
  - Cambios de permisos.
  - Suspensión de usuarios.
  - Borrado lógico y restauraciones.
  - Acciones del Administrador de plataforma.
  - Operaciones biométricas cuando se implementen.
- Terminado cuando: las acciones críticas generan registros sin guardar secretos ni datos sensibles innecesarios.

### Configurar calidad del código

- Responsable: Full-Stack.
- Etiquetas: `FULLSTACK`, `QA`, `MVP`.
- Checklist:
  - ESLint.
  - Formato consistente.
  - Type checking.
  - Pruebas automatizadas.
  - Convenciones de ramas y commits.
  - Revisión mediante pull request.
- Terminado cuando: el proyecto tiene comandos documentados para validar código antes de integrar cambios.

## Lista: 04 - Primer flujo vertical del MVP

### Registrar miembro

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `FULLSTACK`, `MVP`.
- Incluye:
  - Formulario validado.
  - Detección de posibles duplicados.
  - Inserción bajo RLS.
  - Foto opcional en Storage.
  - Estados de carga, error y éxito.
  - Registro de auditoría cuando corresponda.
- Terminado cuando: un usuario autorizado registra un miembro y otro gimnasio no puede consultarlo.

### Crear plan y membresía

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `FULLSTACK`, `MVP`.
- Incluye:
  - Seleccionar o crear plan.
  - Definir fecha de inicio.
  - Calcular fecha de vencimiento según reglas aprobadas.
  - Crear la suscripción del miembro.
  - Mostrar estado inicial.
- Terminado cuando: la membresía se crea con datos válidos y se respeta el gimnasio activo.

### Generar cargo de membresía

- Responsable: Full-Stack.
- Etiquetas: `SUPABASE`, `FULLSTACK`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Utilizar RPC existente o crear una migración incremental.
  - Evitar cargos duplicados.
  - Guardar monto y moneda con tipo decimal.
  - Registrar periodo y vencimiento.
  - Ejecutar la operación de forma atómica.
- Terminado cuando: el cargo se genera una sola vez y puede consultarse en el estado de cuenta.

### Registrar y aplicar pago

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `FULLSTACK`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Consultar deuda real desde Supabase.
  - Registrar método de pago.
  - Guardar monto y moneda.
  - Guardar tasa aplicada si existe conversión.
  - Aplicar el pago a cargos.
  - Generar recibo único.
  - Evitar cálculos críticos solamente en el navegador.
  - Registrar anulación mediante operación auditada.
- Terminado cuando: el saldo se actualiza de forma atómica y las transacciones históricas se conservan.

### Consultar estado del miembro

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `MVP`.
- Mostrar:
  - Datos básicos.
  - Membresía actual.
  - Fecha de vencimiento.
  - Saldo pendiente.
  - Estado de acceso.
  - Alertas relevantes.
- Terminado cuando: la vista utiliza una consulta, vista o RPC documentada y no reconstruye reglas críticas en el frontend.

### Registrar entrada

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `FULLSTACK`, `MVP`.
- Checklist:
  - Buscar miembro.
  - Consultar estado de acceso.
  - Mostrar activo, vencido, moroso o bloqueado.
  - Registrar entrada.
  - Evitar entradas duplicadas accidentales.
  - Mostrar motivo cuando el acceso no procede.
- Terminado cuando: la recepción completa el proceso en pocos pasos y el evento queda registrado para el gimnasio correcto.

### Probar el flujo vertical completo

- Responsable: Full-Stack + Vibe Coder + Producto.
- Etiquetas: `QA`, `MVP`.
- Recorrido:
  - Crear gimnasio de prueba.
  - Crear dueño o usuario autorizado.
  - Registrar miembro.
  - Crear membresía.
  - Generar cargo.
  - Registrar pago.
  - Consultar estado.
  - Registrar entrada.
- Prueba adicional:
  - Repetir con un segundo gimnasio.
  - Intentar acceder a datos cruzados.
- Terminado cuando: el recorrido funciona y las pruebas de aislamiento no encuentran acceso entre gimnasios.

## Lista: 05 - Desarrollo de módulos restantes del MVP

### Módulo de gimnasios y sucursales

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `MVP`.
- Incluye:
  - Alta.
  - Estado.
  - Configuración.
  - Moneda preferida.
  - Tasa actual cuando sea implementada.
  - Sucursales.
  - Archivado y restauración autorizada.
- Terminado cuando: el Dueño administra únicamente su gimnasio y el Administrador de plataforma utiliza un flujo separado y auditado.

### Módulo de personal

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `SEGURIDAD`, `MVP`.
- Incluye:
  - Invitar.
  - Activar.
  - Suspender.
  - Reactivar.
  - Asignar rol.
  - Consultar permisos efectivos.
- Terminado cuando: los cambios se aplican en Supabase Auth y en la relación del usuario con el gimnasio sin dejar accesos huérfanos.

### Módulo de miembros

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `MVP`.
- Incluye:
  - Alta.
  - Edición.
  - Búsqueda.
  - Estado.
  - Historial.
  - Foto opcional.
  - Borrado lógico y restauración autorizada.
- Terminado cuando: los CRUD permitidos, historial y Storage respetan RLS y permisos.

### Módulo de planes y membresías

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `MVP`.
- Incluye:
  - Planes.
  - Precios.
  - Vigencia.
  - Beneficios.
  - Estados.
  - Renovación.
  - Cancelación.
  - Reactivación si fue aprobada.
- Terminado cuando: los estados y transiciones coinciden con las reglas de Producto.

### Módulo de pagos y recibos

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `SEGURIDAD`, `MVP`.
- Requisitos:
  - No usar números flotantes para dinero.
  - Guardar monto, moneda y tasa aplicada.
  - No recalcular transacciones históricas al cambiar la tasa.
  - Corregir mediante anulación o ajuste auditado, no borrado.
  - Crear un recibo único por pago.
  - Proteger operaciones mediante RPC o función de servidor confiable.
- Terminado cuando: pagos completos, parciales y correcciones aprobadas funcionan de forma atómica.

### Módulo de entradas

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `MVP`.
- Incluye:
  - Búsqueda.
  - Validación de membresía.
  - Registro.
  - Consulta diaria.
  - Alertas.
  - Método QR si fue aprobado.
- Terminado cuando: cada evento queda asociado al gimnasio, miembro, usuario y fecha correspondientes.

### Módulo simple de ingresos

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `MVP`.
- Incluye:
  - Ingresos por pagos de miembros.
  - Otros ingresos autorizados.
  - Categorías.
  - Filtros por fecha y moneda.
  - Totales diarios y mensuales.
- No incluye:
  - Contabilidad completa.
  - Gastos.
  - Estados financieros formales.
- Terminado cuando: el dueño puede consultar ingresos del día y del mes con fuentes de datos verificadas.

### Caja básica

- Responsable: Producto + Frontend + Full-Stack.
- Etiquetas: `PRODUCTO`, `FRONTEND`, `SUPABASE`, `MVP`.
- Estado: implementar solamente si fue confirmada como necesaria para el piloto.
- Incluye:
  - Apertura.
  - Movimientos.
  - Totales por moneda.
  - Cierre.
  - Diferencias auditadas.
- Terminado cuando: las reglas fueron validadas y la caja puede cerrarse sin alterar pagos históricos.

### Reportes esenciales

- Responsable: Frontend + Full-Stack.
- Etiquetas: `FRONTEND`, `SUPABASE`, `MVP`.
- Reportes:
  - Miembros activos.
  - Membresías vencidas o próximas a vencer.
  - Morosos.
  - Pagos por periodo y moneda.
  - Entradas por periodo.
  - Ingresos por periodo.
  - Cierre de caja si se implementa.
- Terminado cuando: cada cifra tiene definición, consulta y filtros documentados.

### Exportar datos

- Responsable: Full-Stack.
- Etiquetas: `FULLSTACK`, `SUPABASE`, `MVP`.
- Incluye:
  - CSV de miembros.
  - CSV de pagos.
  - Filtros por gimnasio y periodo.
  - Permisos financieros.
  - Protección contra exportación de otro gimnasio.
- Terminado cuando: un usuario autorizado exporta solamente los datos permitidos de su gimnasio.

## Lista: 06 - Pruebas y seguridad

### Pruebas automáticas críticas

- Responsable: Full-Stack.
- Etiquetas: `QA`, `SEGURIDAD`, `MVP`.
- Casos:
  - Separación entre gimnasios.
  - Políticas RLS.
  - Permisos por rol.
  - Registro de miembro.
  - Generación de cargos sin duplicados.
  - Pagos completos y parciales.
  - Cálculo USD y NIO.
  - Cambio de tasa sin modificar pagos anteriores.
  - Renovación y vencimiento.
  - Anulación de pagos.
  - Borrado lógico y restauración.
  - Acceso a Storage.
  - Cierre de caja si se implementa.
- Terminado cuando: las pruebas se ejecutan mediante un comando documentado y no hay fallos críticos.

### Pruebas de recorrido completo

- Responsable: Full-Stack + Vibe Coder.
- Etiquetas: `QA`, `MVP`.
- Recorridos:
  - Crear gimnasio y dueño.
  - Crear recepcionista.
  - Registrar miembro.
  - Cobrar membresía.
  - Registrar entrada.
  - Encontrar moroso.
  - Consultar ingresos.
  - Cerrar caja si se implementa.
- Terminado cuando: cada recorrido fue ejecutado en un ambiente que no contiene datos reales.

### Pruebas de aislamiento multi-tenant

- Responsable: Full-Stack.
- Etiquetas: `QA`, `SEGURIDAD`, `SUPABASE`, `MVP`.
- Checklist:
  - Crear dos gimnasios de prueba.
  - Crear usuarios con distintos roles.
  - Intentar leer datos cruzados.
  - Intentar insertar usando otro `gym_id`.
  - Intentar modificar y eliminar datos cruzados.
  - Intentar acceder a archivos de otro gimnasio.
  - Revisar operaciones con `service_role`.
- Terminado cuando: todos los intentos no autorizados son rechazados y quedan documentados.

### Revisión de seguridad

- Responsable: Full-Stack.
- Etiquetas: `SEGURIDAD`, `QA`, `MVP`.
- Checklist:
  - Autorización mediante RLS y servidor, no solamente botones ocultos.
  - Validación de archivos e imágenes.
  - Protección contra inyección y XSS.
  - Revisión de CSRF en operaciones basadas en cookies.
  - Secretos fuera del repositorio.
  - `service_role` fuera del navegador.
  - HTTPS.
  - Auditoría protegida.
  - Dependencias revisadas.
  - Rate limiting en operaciones sensibles.
  - Restauración de respaldo probada.
- Terminado cuando: no quedan riesgos críticos abiertos para el piloto.

### Prueba de usabilidad

- Responsable: Vibe Coder.
- Etiquetas: `VIBE`, `QA`, `MVP`.
- Meta: una recepcionista nueva completa registro, cobro y entrada sin ayuda.
- Terminado cuando: se registran resultados, tiempos y problemas observados.

### Validar respaldo y restauración

- Responsable: Full-Stack.
- Etiquetas: `DEVOPS`, `SUPABASE`, `SEGURIDAD`, `MVP`.
- Checklist:
  - Documentar respaldo de PostgreSQL.
  - Documentar respaldo o recuperación de archivos importantes.
  - Ejecutar una restauración en un entorno separado.
  - Verificar relaciones, funciones, RLS y datos restaurados.
- Terminado cuando: existe evidencia de una restauración exitosa.

## Lista: 07 - Piloto

### Preparar ambiente de demostración

- Responsable: Full-Stack.
- Etiquetas: `DEVOPS`, `SUPABASE`, `FRONTEND`, `MVP`.
- Requisitos:
  - Proyecto Supabase de desarrollo o demostración.
  - Aplicación Next.js desplegada en Vercel.
  - Variables de entorno separadas.
  - Datos falsos.
  - Sin secretos ni datos reales sensibles.
- Terminado cuando: el equipo puede demostrar el flujo completo desde una URL controlada.

### Preparar ambiente piloto

- Responsable: Full-Stack.
- Etiquetas: `DEVOPS`, `SEGURIDAD`, `MVP`.
- Requisitos:
  - Proyecto Supabase separado para producción.
  - Proyecto de Vercel separado o configuración protegida.
  - Dominio y HTTPS.
  - Backups.
  - Monitoreo y logs sin datos sensibles.
  - Variables de entorno.
  - Procedimiento de migración.
  - Procedimiento de rollback o recuperación.
- Terminado cuando: el ambiente fue revisado y no comparte datos ni secretos con desarrollo.

### Incorporar primer gimnasio

- Responsable: Producto + Full-Stack.
- Etiquetas: `PRODUCTO`, `MVP`.
- Checklist:
  - Crear gimnasio y dueño.
  - Configurar sucursal.
  - Configurar moneda y tasa cuando esté disponible.
  - Crear personal.
  - Importar miembros si corresponde.
  - Capacitar dueño y recepción.
  - Obtener consentimiento para tratamiento de datos.
  - Definir canal de soporte.
- Terminado cuando: el gimnasio puede operar el flujo principal con asistencia mínima.

### Ejecutar piloto de 30 días

- Responsable: Producto.
- Etiquetas: `PRODUCTO`, `QA`, `MVP`.
- Checklist:
  - Revisión diaria durante la primera semana.
  - Revisión semanal después.
  - Registrar errores y solicitudes.
  - Medir criterios de éxito.
  - Revisar seguridad y calidad de datos.
  - No agregar funciones fuera del MVP salvo bloqueo crítico.
- Terminado cuando: existe un informe del piloto con métricas, problemas y decisión de continuidad.

## Lista: 08 - Lanzamiento

### Corregir bloqueadores del piloto

- Responsable: Full-Stack + Vibe Coder.
- Etiquetas: `QA`, `MVP`.
- Terminado cuando: no quedan fallos críticos de seguridad, dinero, permisos, pérdida de datos o aislamiento multi-tenant.

### Preparar operación comercial

- Responsable: Producto.
- Etiquetas: `PRODUCTO`.
- Checklist:
  - Precio y condiciones.
  - Contrato.
  - Política de privacidad.
  - Tratamiento de datos biométricos si se utiliza.
  - Proceso de ventas.
  - Proceso de onboarding.
  - Soporte y tiempos de respuesta.
  - Cancelación.
  - Exportación y eliminación de datos.
- Terminado cuando: el equipo puede incorporar un gimnasio con condiciones claras y documentación mínima.

### Lanzar a los primeros gimnasios

- Responsable: Producto + Full-Stack.
- Etiquetas: `PRODUCTO`, `FULLSTACK`.
- Estrategia: incorporar pocos gimnasios, estabilizar el sistema y aumentar ventas gradualmente.
- Terminado cuando: cada gimnasio incorporado tiene dueño, configuración, capacitación y soporte definidos.

## Lista: 09 - Después del MVP

### Portal del miembro

- Etiquetas: `DESPUÉS`.

### Acceso para entrenadores

- Etiquetas: `DESPUÉS`.

### Rutinas, medidas y progreso

- Etiquetas: `DESPUÉS`.

### Inventario y mantenimiento de máquinas

- Etiquetas: `DESPUÉS`.

### Recordatorios por WhatsApp

- Etiquetas: `DESPUÉS`.

### Aplicación móvil

- Etiquetas: `DESPUÉS`.

### Integración con control físico de puertas

- Etiquetas: `DESPUÉS`.

### Reconocimiento facial completo

- Etiquetas: `DESPUÉS`, `SEGURIDAD`.
- Incluye:
  - Consentimiento biométrico.
  - Fotografías en Storage.
  - Generación de embeddings en un servicio confiable.
  - Comparación mediante `pgvector`.
  - Registro de eventos y alertas.
  - Revisión manual de coincidencias dudosas.
  - Retención y eliminación de datos biométricos.

### Suscripción y cobro automático del SaaS

- Etiquetas: `DESPUÉS`, `PRODUCTO`, `SEGURIDAD`.

## Lista: 10 - Terminado

Mover una tarjeta aquí solamente cuando:

- Cumple sus criterios de terminado.
- Fue revisada por el responsable apropiado.
- Tiene pruebas proporcionales al riesgo.
- No rompe separación entre gimnasios ni permisos.
- No expone secretos.
- No altera transacciones históricas de forma incorrecta.
- La documentación necesaria fue actualizada.
- Las migraciones afectadas están versionadas.
- El resultado fue verificado en un recorrido realista.

## Orden recomendado de ejecución

1. Entrevistas y decisiones pendientes.
2. Alcance cerrado del MVP.
3. Diseño de los flujos principales.
4. Versionar y validar las migraciones existentes.
5. Configurar Next.js, Supabase Auth y clientes de servidor y navegador.
6. Diseñar contrato de acceso a datos.
7. Validar multi-tenancy, RLS, roles y permisos.
8. Implementar el primer flujo vertical.
9. Completar módulos restantes del MVP.
10. Ejecutar pruebas, revisión de seguridad y restauración.
11. Preparar demostración y piloto.
12. Corregir bloqueadores y lanzar gradualmente.