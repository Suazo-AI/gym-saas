# Decisiones de producto — FitManager

Registro de decisiones cerradas. Cada una manda sobre cualquier suposición previa,
incluido `AGENTS.md`. Si `AGENTS.md` contradice una decisión de este archivo, gana
este archivo y `AGENTS.md` debe corregirse.

---

## D-001 — Moneda y tasa de cambio

**Fecha:** 2026-07-28
**Decidido por:** Jason
**Estado:** cerrada

### Decisión

El MVP opera únicamente en **córdoba nicaragüense (NIO)**.

**Tasa de cambio: US$1 = C$36.60**

### Alcance

- Los cargos, pagos e ingresos de miembros se registran en NIO.
- No se construye selector de moneda en la interfaz del MVP.
- La tasa 36.60 aplica solo donde exista un monto originalmente en USD.

### Reglas de aplicación

- La tasa se guarda **por gimnasio**.
- La tasa aplicada debe guardarse **en cada transacción convertida**.
- Cambiar la tasa solo afecta transacciones nuevas.
- Las transacciones históricas **no** se recalculan.
- Los montos se almacenan en PostgreSQL como `numeric`, nunca `float` ni `double`.

### Pendiente antes de migrar

Falta cerrar en qué moneda se factura el **SaaS** (lo que el gimnasio paga a la
plataforma), porque determina si hace falta tabla de tasa de cambio:

- Si el SaaS también se cobra en NIO → no se necesita tabla de tasa en el MVP.
- Si el SaaS se factura en USD → sí se necesita tasa por gimnasio.

No escribir la migración de tasa de cambio hasta cerrar este punto.

### Corrige

`AGENTS.md` indica "tasa inicial de referencia C$36.50" y "operación en USD y NIO".
Ambas quedan superadas por esta decisión.
