# Reglas de planes, membresías y tipo de cambio

**Fecha:** 2026-08-04  
**Tarjeta:** Módulo de planes y membresías  
**Estado:** diseño aprobado por Producto; pendiente de plan técnico e implementación

## Objetivo

Permitir que cada gimnasio configure sus propios planes y administre el ciclo completo de una membresía sin alterar registros financieros históricos ni romper el aislamiento multi-tenant.

Esta entrega incluye como dependencia una tasa de cambio configurable por gimnasio. No incluye la mini tienda/POS ni inventario, que permanecen para una fase posterior.

## Planes configurables

El Dueño o un Gerente autorizado podrá crear y editar planes con:

- código y nombre;
- descripción y beneficios;
- precio exacto como valor decimal;
- moneda USD o NIO;
- duración compuesta por cantidad y unidad: día, semana o mes;
- días de gracia desde cero;
- renovación automática o manual;
- estado activo o inactivo;
- borrado lógico y restauración.

Los códigos serán únicos por gimnasio entre planes no retirados. Un plan utilizado históricamente no se eliminará físicamente. Cambiar el precio, moneda o duración afectará solamente suscripciones nuevas; una suscripción conservará una instantánea de las condiciones aceptadas.

## Alta y renovación

Una suscripción nueva genera el cargo completo del período por adelantado. No habilita acceso hasta que el cargo esté pagado completamente.

No se admitirán pagos parciales. Un pago deberá cubrir el total exigible de la operación. Los descuentos aprobados forman parte del importe final antes del pago.

La renovación puede ser automática o manual según el plan. Una renovación genera un nuevo período y su cargo completo. Los días de gracia aplican únicamente a renovaciones de miembros previamente activos: durante la gracia se permite entrada con advertencia de pago pendiente. Una membresía nueva nunca obtiene gracia antes del primer pago.

## Descuentos

Una suscripción podrá tener un descuento porcentual o de monto fijo con:

- motivo obligatorio;
- fecha inicial;
- fecha final opcional;
- usuario responsable;
- auditoría.

El descuento se aplicará solamente a cargos nuevos. No modificará cargos ni pagos históricos y nunca podrá producir un cargo negativo.

## Congelamiento

Una membresía podrá congelarse con fecha inicial, fecha de reactivación y motivo obligatorio. Durante el congelamiento no se generarán cargos ni se permitirá acceso.

La fecha de vencimiento se extenderá por la cantidad exacta de días congelados. El evento, actor y fechas quedarán auditados.

## Cancelación y reactivación

La cancelación podrá ser:

- inmediata;
- al finalizar el período vigente.

Una cancelación inmediata ofrecerá cancelación sin reembolso o reembolso proporcional. La cancelación al final del período no generará reembolso. Ninguna cancelación eliminará cargos, pagos, aplicaciones o eventos históricos.

Una persona que vuelva después de cancelar recibirá una suscripción nueva. La suscripción cancelada permanecerá cerrada como historial.

## Cambio de plan

El cambio podrá programarse para finalizar el período actual o ejecutarse inmediatamente.

Un cambio programado no altera el período vigente y comienza al vencimiento. Un cambio inmediato cierra el período anterior, crea una nueva suscripción y calcula crédito por días completos no utilizados:

```text
crédito = precio pagado / días totales del período * días completos restantes
```

El resultado monetario debe redondearse de forma determinista a dos decimales dentro de PostgreSQL. La interfaz mostrará dos decisiones:

- aplicar el crédito al nuevo plan;
- solicitar un reembolso.

El crédito se expresa primero en la moneda de la transacción original. Si el nuevo plan utiliza otra moneda, la conversión empleará la tasa vigente del gimnasio y guardará la tasa aplicada. Los cargos y pagos anteriores permanecen sin cambios.

## Reembolsos

Todo reembolso estará vinculado al pago original y conservará:

- monto;
- moneda original;
- tasa aplicada cuando exista conversión;
- método real de devolución;
- motivo;
- usuario responsable;
- fecha y estado;
- registro de auditoría.

El pago original no se elimina ni se reescribe. Los reembolsos no podrán superar el monto efectivamente pagado menos reembolsos anteriores.

## Tipo de cambio por gimnasio

Configuración incluirá una sección **Tipo de cambio**. La tasa se expresa como córdobas por dólar estadounidense y comienza en:

```text
US$1 = C$36.60
```

Reglas:

- cada gimnasio mantiene su propia tasa;
- únicamente el Dueño puede modificarla;
- el valor debe ser decimal positivo y usar precisión de PostgreSQL;
- cada modificación registra valor anterior, valor nuevo, actor y fecha;
- una tasa nueva afecta solamente transacciones posteriores;
- toda transacción convertida guarda la tasa utilizada;
- las transacciones históricas nunca se recalculan.

La autorización no dependerá del nombre visible del rol. La operación segura comprobará que el usuario tenga una asignación activa al rol protegido de propietario del gimnasio o un permiso exclusivo no delegable definido para esta acción.

## Permisos

- **Dueño:** planes, membresías, pagos, cancelaciones, cambios, reembolsos y tipo de cambio.
- **Gerente autorizado:** planes, membresías, pagos, cancelaciones, cambios y reembolsos; no modifica el tipo de cambio.
- **Recepcionista:** asigna y renueva membresías y registra pagos completos; no cambia precios, no administra planes y no emite reembolsos.

La interfaz ocultará acciones no disponibles por usabilidad, pero RLS y RPC serán la autoridad real.

## Arquitectura y atomicidad

Toda modificación de datos requerirá migraciones incrementales nuevas. No se editarán migraciones aplicadas.

Las operaciones de alta/renovación con cargo, cambio inmediato, cancelación, crédito, reembolso, congelamiento y modificación de tasa se ejecutarán mediante RPC atómicas con bloqueo de las filas financieras relevantes. Las RPC derivarán el gimnasio desde relaciones verificables y comprobarán usuario autenticado, pertenencia activa, permiso, estado lógico y moneda.

El frontend utilizará Server Actions con Zod, derivará el gimnasio activo en el servidor y tratará montos como cadenas decimales. No confiará en precios, totales, tasas, permisos ni `gym_id` enviados por el navegador.

## Interfaz

La pantalla de membresías tendrá:

- listado y filtros de planes;
- creación y edición de planes;
- beneficios;
- activación, retiro lógico y restauración;
- vista de suscripciones por miembro;
- asignación y renovación;
- congelamiento y reactivación;
- cambio de plan programado o inmediato;
- cancelación;
- explicación previa de cargos, crédito o reembolso;
- estados de carga, vacío, validación, permiso, conflicto y error.

Configuración mostrará la tasa actual, la unidad `C$ por US$1`, la fecha de actualización y el formulario disponible solo para el Dueño.

## Pruebas y terminado

Las pruebas SQL cubrirán como mínimo:

- Dueño autorizado;
- Gerente con y sin permiso;
- Recepcionista con límites operativos;
- usuario de otro gimnasio;
- usuario no autenticado;
- duración por día, semana y mes;
- pago completo obligatorio;
- gracia solo en renovaciones;
- congelamiento y extensión exacta;
- descuentos sin retroactividad;
- cancelación inmediata y al final del período;
- cambio programado e inmediato;
- prorrateo y redondeo;
- crédito, conversión y reembolso sin excedentes;
- cambio de tasa sin alterar transacciones históricas;
- auditoría sin secretos ni cargas financieras completas innecesarias.

También se exigirán pruebas de esquemas, repositorios, Server Actions, componentes, typecheck, lint, build y un recorrido realista con dos gimnasios.

## Trabajo separado

- **Mini tienda/POS e inventario:** fase futura. Recepcionista tendrá permisos operativos cuando esa tarjeta sea aprobada; ajustes de inventario, costos y reportes sensibles requerirán permisos superiores.
- **Editor dinámico de roles y accesos:** tarjeta separada. El Dueño podrá crear roles, seleccionar pantallas y acciones y asignarlos a usuarios. Las definiciones vivirán en Supabase y serán aplicadas por RLS/RPC; no estarán codificadas únicamente en el frontend.

