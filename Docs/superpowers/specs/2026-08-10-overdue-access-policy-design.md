# Política de morosidad, gracia y acceso

**Fecha:** 2026-08-10

**Tarjeta:** Mejorar el sistema de vencimientos

## Objetivo

Aplicar de forma consistente las reglas aprobadas de morosidad y gracia en búsquedas, entradas manuales, reconocimiento facial, alertas y reportes, sin almacenar un estado vencido que pueda desincronizarse de cargos, pagos y fechas.

## Decisiones aprobadas

- El primer cargo de una membresía no recibe gracia. Si está `pending` o `partial`, el acceso queda bloqueado desde `start_date` hasta pagarlo completamente.
- Un cargo de renovación pendiente o parcial permite acceso durante los días de gracia configurados en el plan.
- El último día de gracia es `due_date + grace_days`, inclusive.
- Después de ese día, cualquier saldo de renovación bloquea la entrada.
- La deuda no se elimina ni se modifica por permitir una entrada.
- Un usuario con `entries.manage`, incluida recepción, puede autorizar manualmente una entrada bloqueada. Debe escribir un motivo y la excepción queda auditada.
- El reconocimiento facial no concede por sí solo una excepción manual.

## Estado financiero canónico

PostgreSQL calculará un único estado financiero de acceso para la suscripción vigente:

| Estado | Condición | Acceso ordinario |
|---|---|---|
| `paid` | No existe saldo que impida o advierta el acceso. | Permitido |
| `initial_payment_required` | El primer cargo tiene saldo pendiente. | Bloqueado |
| `grace` | Un cargo de renovación venció, conserva saldo y todavía está dentro de la gracia. | Permitido con advertencia |
| `overdue` | Un cargo de renovación conserva saldo después de terminar la gracia. | Bloqueado |

La prioridad cuando coinciden cargos es:

```text
initial_payment_required > overdue > grace > paid
```

El saldo de un cargo se calcula con sus aplicaciones de pagos `settled` y se expresa en la moneda original. Un cargo `paid` o `void` no bloquea. Los reembolsos y anulaciones utilizan los contratos financieros existentes para recalcular el saldo; no se inspeccionan montos enviados por el cliente.

## Morosidad

Un miembro es moroso cuando existe un cargo `pending` o `partial` cuya `due_date` ya pasó y conserva saldo. La morosidad comienza al día siguiente del vencimiento, aunque todavía exista tolerancia de acceso por gracia.

Por tanto:

- `grace` significa moroso con entrada temporalmente permitida;
- `overdue` significa moroso con entrada bloqueada;
- `initial_payment_required` no se presenta como renovación morosa: se presenta como pago inicial pendiente.

Los reportes pueden contar morosos desde el vencimiento, pero deben separar “en gracia” y “bloqueados” cuando muestren decisiones de acceso.

## Integración con acceso

`private.member_access_allowed` seguirá siendo la decisión booleana consumida por los contratos existentes, pero delegará la parte financiera al estado canónico.

Además de validar el estado financiero, continuará exigiendo:

- miembro activo;
- suscripción vigente y no congelada, cancelada ni expirada;
- fecha de inicio alcanzada y fecha final no superada;
- pertenencia al gimnasio resuelta por relaciones confiables.

Las vistas y RPC expuestas devolverán el estado financiero calculado. El navegador no decidirá si corresponde gracia o bloqueo.

## Entrada manual

- `paid`: muestra “Permitida”.
- `grace`: registra `allowed`, muestra “En gracia” y una advertencia de pago pendiente sin exponer montos ni datos innecesarios.
- `initial_payment_required`: registra `denied` con “Pago inicial pendiente”.
- `overdue`: registra `denied` con “Morosa fuera del período de gracia”.
- Si existe motivo de excepción en un acceso bloqueado, registra `manual_review`, conserva el estado financiero original y crea `entry.override` en auditoría.

La excepción manual no cambia cargos, gracia, estado del miembro ni decisiones futuras.

## Reconocimiento facial

La verificación facial usa la misma decisión de servidor:

- `paid` y `grace` pueden producir acceso permitido si las demás validaciones pasan;
- `initial_payment_required` y `overdue` producen acceso denegado;
- un resultado facial denegado requiere revisión humana; no acepta un override implícito.

## Alertas

- Una entrada permitida en `grace` genera una alerta de advertencia, como máximo una por miembro y cargo durante el período de gracia.
- Una entrada denegada por `overdue` o `initial_payment_required` genera una alerta de bloqueo.
- Una entrada autorizada manualmente genera auditoría y conserva la alerta financiera correspondiente.
- Las alertas no incluyen montos completos ni información biométrica.

La deduplicación exacta se hará por gimnasio, miembro, cargo y tipo de alerta para evitar ruido sin ocultar deudas diferentes.

## Superficies de consulta

- Búsqueda de entrada: muestra `Al día`, `Pago inicial pendiente`, `En gracia` o `Morosa bloqueada`.
- Dashboard del dueño: conserva total de morosos y agrega separación entre miembros en gracia y bloqueados cuando el contrato del dashboard se amplíe.
- Listado de miembros: el filtro de morosidad continúa usando deuda vencida; el estado visual distingue gracia y bloqueo.
- Historial de entradas: conserva la decisión tomada y el estado financiero observado en ese momento para que cambios posteriores no reescriban el pasado.

## Contrato y migración

Se creará una migración incremental que:

1. agregue una función privada para calcular `paid`, `initial_payment_required`, `grace` u `overdue`;
2. actualice `private.member_access_allowed` para consumirla;
3. amplíe las vistas/RPC de acceso necesarias con el estado calculado;
4. conserve los campos booleanos existentes durante esta entrega para no romper consumidores;
5. guarde el estado observado en eventos nuevos de entrada sin modificar eventos históricos.

No se editarán migraciones ya aplicadas ni se agregará un proceso programado para derivar morosidad.

## Seguridad y pruebas

pgTAP cubrirá como mínimo:

- primer cargo pendiente y parcialmente pagado bloquean sin gracia;
- primer cargo pagado permite acceso;
- renovación pendiente dentro de gracia permite acceso y devuelve `grace`;
- renovación parcial fuera de gracia bloquea y devuelve `overdue`;
- `grace_days=0` respeta el vencimiento inclusivo;
- pagar el saldo restaura acceso inmediatamente;
- miembro suspendido o de otro gimnasio no obtiene acceso;
- override manual exige motivo, se registra y no modifica la deuda;
- reconocimiento facial respeta la misma decisión sin override.

Las pruebas de TypeScript cubrirán etiquetas, mensajes y compatibilidad de DTO. La verificación final incluye pgTAP completo, Vitest, lint, typecheck y build.

## Fuera de alcance

- cobro automático mediante proveedor externo;
- intereses o recargos por mora;
- negociación o condonación de deuda;
- permisos nuevos para overrides;
- cambio de las reglas de congelamiento, cancelación o cambio de plan;
- procesos programados de renovación, expiración o cancelación.

## Criterio de terminado

Todas las superficies de entrada consumen el mismo estado calculado; el primer pago no recibe gracia; renovaciones en gracia se permiten con advertencia; renovaciones fuera de gracia se bloquean; y las excepciones manuales continúan disponibles con motivo y auditoría.
