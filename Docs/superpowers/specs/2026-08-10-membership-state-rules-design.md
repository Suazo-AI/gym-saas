# Reglas definitivas de membresías

**Fecha:** 2026-08-10

**Tarjeta:** Definir reglas de membresía

**Responsable:** Producto + Full-Stack

**Alcance:** reglas de producto y transiciones; no implementa las brechas señaladas al final.

## Decisiones principales

- El plan inicial del MVP es mensual, pero el contrato admite duraciones configurables en días, semanas o meses.
- La membresía se cobra por período adelantado.
- Una membresía nueva no habilita acceso hasta pagar completamente el primer cargo.
- Los pagos parciales están permitidos. Reducen el saldo, pero no equivalen a pago completo.
- Los días de gracia aplican solamente a cargos de renovación de una membresía previamente pagada y activa.
- Renovar, congelar, cancelar, reactivar o cambiar de plan nunca elimina ni reescribe cargos, pagos o eventos históricos.
- Todo monto y saldo se mantiene separado por moneda. No se compensan USD y NIO sin una conversión explícita que guarde la tasa aplicada.

## Plan inicial y duración

El gimnasio crea inicialmente un plan de un mes. Cada plan define:

- cantidad de duración positiva;
- unidad `day`, `week` o `month`;
- precio decimal;
- moneda `USD` o `NIO`;
- días de gracia iguales o mayores que cero;
- renovación manual o automática;
- estado activo o inactivo.

La suscripción guarda una copia de duración, precio, moneda y modalidad de renovación. Editar el plan afecta suscripciones nuevas y renovaciones futuras; nunca recalcula períodos ni cargos ya creados.

## Fechas

- `start_date` es el primer día incluido en el período.
- `period_end` es inclusivo y se calcula como `start_date + duración - 1 día`.
- El siguiente período comienza en `period_end + 1 día`.
- Para meses se usa aritmética de calendario de PostgreSQL. Por ejemplo, un período mensual iniciado el 1 de enero termina el 31 de enero.
- La fecha de vencimiento del cargo inicial es `start_date`.
- La fecha de vencimiento de cada renovación es el primer día de su período.
- Una suscripción sin renovación automática tiene `end_date = period_end` desde su creación.
- Una suscripción con renovación automática mantiene `end_date` abierto hasta que se programe o ejecute su cierre.

No se aceptan períodos superpuestos para un mismo miembro.

## Estados de la suscripción

Los estados válidos del esquema son `trialing`, `active`, `past_due`, `paused`, `canceled` y `expired`. Para membresías del MVP se aplican así:

| Estado | Significado | Acceso |
|---|---|---|
| `trialing` | Reservado. El MVP no crea pruebas gratuitas para miembros. | No se utiliza. |
| `active` | La relación contractual está vigente. | Depende de fecha, congelamiento y cargos. |
| `past_due` | Reservado como estado persistido. En el MVP la morosidad se deriva de cargos vencidos. | Denegado fuera de la gracia. |
| `paused` | Membresía congelada durante un intervalo aprobado. | Denegado. |
| `canceled` | Cancelación efectiva; no genera períodos nuevos. | Denegado. |
| `expired` | Terminó el último período y no hubo renovación. | Denegado. |

`past_due` no debe escribirse para representar morosidad mientras el contrato vigente la derive de los cargos. La fuente de verdad financiera es cada cargo y su saldo.

## Estados de cargos y pagos

Un cargo usa `pending`, `partial`, `paid` o `void`. El estado `overdue` no se almacena: se deriva cuando un cargo `pending` o `partial` supera su fecha límite aplicable.

- `pending → partial`: existe al menos una aplicación válida y queda saldo.
- `pending → paid`: las aplicaciones cubren exactamente el cargo.
- `partial → partial`: entra otro abono y todavía queda saldo.
- `partial → paid`: el saldo llega exactamente a cero.
- `pending|partial → void`: únicamente mediante una operación autorizada y auditada; sus aplicaciones existentes deben resolverse antes.
- Un pago registrado queda `settled`; el carácter parcial pertenece al cargo, no al pago.
- Un pago puede distribuirse entre varios cargos del mismo miembro y moneda.
- La suma de aplicaciones debe ser exactamente igual al monto del pago.
- Ninguna aplicación puede superar el saldo del cargo y el pago total no puede superar la deuda de esa moneda.

## Alta inicial

Transición: `sin suscripción vigente → active`.

Condiciones:

1. miembro y plan pertenecen al gimnasio activo;
2. el plan está activo;
3. no existe otra suscripción `trialing`, `active`, `past_due` o `paused`;
4. se toma la instantánea del plan;
5. se crea el primer período y el cargo completo;
6. se registra el evento y la auditoría.

La suscripción puede quedar almacenada como `active` mientras el primer cargo está pendiente, pero el acceso permanece bloqueado hasta que ese cargo quede `paid`. El primer cargo nunca recibe días de gracia.

## Renovación manual

La renovación manual la inicia un usuario con `memberships.manage`.

- Si la suscripción sigue vigente, el nuevo período empieza al día siguiente del período actual.
- Si ya expiró o fue cancelada, se crea una suscripción nueva; no se reabre la histórica.
- La operación crea un único período y cargo completo de forma atómica.
- Repetir la solicitud con el mismo período no crea un cargo duplicado.
- El cargo puede recibir pagos parciales.

Durante la gracia de una renovación, el acceso continúa con advertencia. Al terminar la gracia, cualquier saldo del cargo bloquea el acceso.

## Renovación automática

La bandera `auto_renew=true` autoriza la generación automática del siguiente período; no representa un cobro automático a una tarjeta.

Al terminar el período:

- si no hay cancelación programada ni congelamiento, se crea el período siguiente y su cargo;
- la suscripción permanece `active`;
- el nuevo cargo comienza `pending` y dispone de los días de gracia del plan;
- si la generación falla, no se crea un período incompleto y el error debe quedar observable.

Con `auto_renew=false`, si no existe renovación manual al finalizar el período, la transición es `active → expired`.

## Días de gracia

- Se cuentan desde la fecha de vencimiento del cargo de renovación.
- El último día permitido es `due_date + grace_days`, inclusive.
- Con `grace_days=0`, un saldo pendiente bloquea acceso después de la fecha de vencimiento.
- La gracia no perdona deuda, no cambia el saldo y no modifica la fecha del período.
- No aplica al cargo inicial, cargos anulados ni suscripciones congeladas o canceladas.

## Congelamiento

Transición: `active → paused`.

Requiere fecha inicial, fecha de reactivación posterior, motivo y actor. No puede solaparse con otro congelamiento ni comenzar después de una cancelación efectiva.

Mientras está `paused`:

- no hay acceso;
- no se generan cargos ni períodos nuevos;
- los cargos anteriores conservan su saldo y siguen siendo cobrables;
- no corren días consumidos del período congelado.

Al llegar la fecha de reactivación, la transición es `paused → active`. El final del período se extiende por la cantidad exacta de días calendario congelados. La reactivación anticipada usa los días realmente transcurridos. Ambas operaciones quedan auditadas.

## Cancelación

### Inmediata

Transición: `active|paused → canceled`.

- Requiere motivo y actor.
- El acceso termina inmediatamente.
- `auto_renew` pasa a `false`.
- No se generan períodos posteriores.
- Los cargos y saldos existentes permanecen.
- Un reembolso, si corresponde, es una operación financiera separada; cancelar no lo crea implícitamente.

### Al final del período

La solicitud mantiene el estado actual y establece `cancel_at_period_end=true`. Al finalizar el período pagado, la transición es `active → canceled`. No se crea el siguiente período ni se concede gracia adicional. Puede revertirse antes de la fecha efectiva; la reversión queda auditada.

## Reactivación

- `paused → active` reanuda la misma suscripción según las reglas de congelamiento.
- Una suscripción `canceled` o `expired` nunca se reabre. El regreso del miembro crea una suscripción nueva con las condiciones vigentes del plan.
- Los saldos de suscripciones anteriores permanecen asociados al miembro y no se trasladan ni desaparecen.
- La nueva membresía no concede acceso si existe deuda vencida que la política de acceso del gimnasio deba bloquear.

## Descuentos

Un descuento puede ser porcentual o fijo y exige motivo, actor, fecha inicial y fecha final opcional.

- Se aplica al crear cargos nuevos dentro de su vigencia.
- El cargo guarda precio base, descuento aplicado e importe final.
- No modifica cargos ni pagos históricos.
- Nunca produce un cargo negativo; el mínimo es cero.
- Los descuentos porcentuales se calculan y redondean a dos decimales en PostgreSQL.
- No se acumulan varios descuentos: debe seleccionarse uno. Cambiar esta regla requiere otra decisión de Producto.

## Cambio de plan

### Programado

- La suscripción actual y su cargo no cambian.
- El plan nuevo comienza al día siguiente del período vigente.
- No hay crédito ni reembolso.
- Si se cancela la membresía antes de la fecha, el cambio programado se anula.

### Inmediato

- Cierra la suscripción actual sin reescribir su historial.
- Calcula crédito por días calendario completos no utilizados:

```text
crédito = monto efectivamente pagado del período / días totales del período × días completos restantes
```

- Redondea a dos decimales en PostgreSQL.
- Crea una suscripción y un cargo nuevos con las condiciones del nuevo plan.
- El usuario elige aplicar el crédito al cargo nuevo o tramitar un reembolso separado.
- Si cambia la moneda, usa la tasa vigente del gimnasio y guarda la tasa aplicada.
- El crédito nunca supera lo efectivamente pagado ni se usa para borrar otros saldos.

## Tratamiento de saldos pendientes

- Los saldos son inmutables respecto de su origen: continúan ligados al cargo y suscripción originales.
- Cancelar, congelar, expirar, reactivar o cambiar de plan no elimina deuda.
- Los abonos se aplican a cargos explícitos; la interfaz propone primero los más antiguos, pero el servidor valida la distribución recibida.
- Un saldo queda vencido después de su fecha límite, considerando gracia solo cuando corresponda.
- Los saldos se muestran y totalizan por moneda.
- No se crea un saldo negativo ni crédito implícito por sobrepago.
- Anulaciones y reembolsos recalculan el saldo mediante operaciones auditadas; nunca editan pagos históricos para ocultar correcciones.

## Matriz de transiciones

| Origen | Acción | Destino | Efecto financiero | Auditoría |
|---|---|---|---|---|
| Sin suscripción | Alta | `active` | Primer cargo completo | Sí |
| `active` | Renovación | `active` | Nuevo cargo completo | Sí |
| `active` sin renovación | Fin del período | `expired` | Conserva saldos | Sí |
| `active` | Congelar | `paused` | Detiene cargos nuevos | Sí |
| `paused` | Reactivar | `active` | Extiende el período | Sí |
| `active|paused` | Cancelar ahora | `canceled` | Conserva saldos | Sí |
| `active` | Programar cancelación | `active` + bandera | No crea cargo futuro | Sí |
| `active` + bandera | Fin del período | `canceled` | Conserva saldos | Sí |
| `canceled|expired` | Regreso | Nueva `active` | Nuevo cargo completo | Sí |
| `active` | Cambio programado | `active` actual y nueva posterior | Cargo nuevo al comenzar | Sí |
| `active` | Cambio inmediato | `canceled` anterior + nueva `active` | Crédito o reembolso separado | Sí |

No existe transición directa desde `canceled` o `expired` hacia `active` sobre la misma fila.

## Permisos y atomicidad

Alta, renovación, congelamiento, reactivación, cancelación y cambio de plan requieren `memberships.manage`. Registrar pagos parciales requiere el permiso de pagos correspondiente. Descuentos y reembolsos requieren permisos explícitos de gestión; una recepcionista no puede definir descuentos ni emitir reembolsos.

Todas las operaciones derivan gimnasio, precios, monedas, fechas, saldos y permisos en PostgreSQL o código de servidor confiable. Las transiciones financieras son atómicas, bloquean las filas relevantes y crean eventos y auditoría sin almacenar secretos.

## Estado de implementación verificado el 10 de agosto de 2026

| Regla | Estado |
|---|---|
| Plan mensual y duración día/semana/mes | Implementado |
| Inicio, período y vencimiento | Implementado |
| Gracia en comprobación de acceso | Implementado con brecha: también alcanza el primer cargo |
| Configuración manual/automática | Implementada |
| Ejecución programada de renovación/expiración | No encontrada |
| Cancelación inmediata | Implementada |
| Finalización automática de cancelación programada | No encontrada |
| Pagos parciales y múltiples cargos | Implementados |
| Saldo pendiente y morosidad derivada | Implementados |
| Congelamiento y reactivación | No implementados |
| Descuentos | No implementados |
| Cambio de plan | No implementado |

Esta tabla informa brechas; no cambia las reglas aprobadas. Cada brecha que se implemente necesita su propia tarjeta, migración incremental, RLS/RPC, pruebas multi-tenant y auditoría.

## Criterio de terminado de esta tarjeta

La tarjeta queda definida cuando Producto acepta estas reglas y no quedan transiciones con origen, destino, efecto financiero o efecto de acceso implícitos. La implementación de las brechas permanece en tarjetas separadas.
