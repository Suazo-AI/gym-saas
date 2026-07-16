# AGENTS.md — Fit Manager

## Preflight obligatorio

Estas instrucciones aplican a todo el repositorio. Antes de analizar, planificar, instalar, editar o ejecutar código, cada agente debe:

1. Leer completamente este `AGENTS.md`.
2. Leer `TRELLO.md`.
3. Identificar la tarea concreta y confirmar que pertenece al MVP.
4. Revisar el estado del repositorio y preservar cambios ajenos.
5. Detenerse si falta una decisión sobre dinero, permisos, seguridad, multi-tenancy o alcance.

Si existe contradicción, `AGENTS.md` gobierna las reglas y decisiones; la discrepancia debe corregirse antes de continuar. Este preflight no puede omitirse.

## Regla técnica de Next.js

La versión instalada de Next.js puede contener cambios recientes en APIs, convenciones y estructura. Antes de usar una API dudosa, leer la guía correspondiente en `node_modules/next/dist/docs/` y respetar avisos de deprecación.

## Producto

Fit Manager es un SaaS multi-tenant para administrar gimnasios pequeños de Nicaragua, inicialmente de 25–100 miembros. Debe simplificar el trabajo de recepción y darle al dueño control sobre miembros, membresías, pagos, morosidad y entradas.

Hipótesis por validar con al menos 10 dueños: el problema principal es controlar pagos, vencimientos y miembros activos cuando trabajan con papel, Excel y WhatsApp. No tratarla como confirmada antes de las entrevistas.

La interfaz será únicamente en español.

## Usuarios iniciales

- Dueño.
- Gerente.
- Recepcionista.
- Administrador interno de la plataforma.

El acceso para entrenadores y el portal del miembro quedan fuera hasta recibir aprobación explícita.

## MVP

Incluye:

- Gimnasios y separación estricta de datos.
- Usuarios, roles y permisos.
- Miembros, planes y membresías.
- Pagos, recibos y morosidad.
- Entradas.
- Caja básica.
- Reportes esenciales.
- USD y NIO.
- Tasa inicial de referencia C$36.50 por US$1, editable por gimnasio.
- Auditoría de operaciones críticas.

Fuera del MVP:

- Aplicación móvil nativa.
- Rutinas, nutrición y acceso de entrenadores.
- Nómina y contabilidad completa.
- Inventario avanzado.
- Control físico de puertas.
- Funciones para grandes cadenas.

## Estado inicial autorizado

La primera versión contiene solamente:

- Landing page de Fit Manager.
- Panel administrativo básico.
- Navegación visual.
- Datos ficticios.

No conectar Supabase, autenticación, APIs, pagos ni servicios externos hasta recibir autorización posterior.

## Tecnología decidida

- Next.js con App Router.
- React y TypeScript.
- CSS Modules.
- Supabase PostgreSQL para datos futuros.
- Supabase Auth para autenticación futura.
- Supabase Storage para imágenes futuras.
- Hosting de Next.js pendiente de seleccionar.

ASP.NET, SQL Server y Somee ya no forman parte de la arquitectura principal.

## Estrategia obligatoria de ramas

- `main`: producción; solo código estable y aprobado.
- `develop`: integración y pruebas.
- Todo cambio comienza en una rama aislada creada desde `develop`.
- Usar nombres como `codex/descripcion`, `feature/descripcion` o `fix/descripcion`.
- Nunca desarrollar directamente en `main` o `develop`.
- Flujo: rama de trabajo → revisión → `develop` → validación → `main`.

## Multi-tenancy y seguridad futura

- Toda entidad comercial pertenecerá a un gimnasio mediante `gymId` o equivalente.
- Cada operación validará el gimnasio activo en el servidor.
- Ocultar controles no sustituye autorización.
- Ningún gimnasio podrá consultar o modificar datos de otro.
- El administrador de plataforma tendrá acceso especial, limitado y auditado.
- No guardar secretos, credenciales ni cadenas de conexión en Git.
- Validar permisos en el servidor y proteger archivos, formularios y rutas.

## Reglas monetarias futuras

- Guardar monto, moneda y tasa aplicada por transacción.
- No usar tipos binarios de coma flotante para dinero.
- Un cambio de tasa solo afecta transacciones nuevas.
- No recalcular transacciones históricas.
- No borrar pagos: anular o corregir con auditoría.

## Responsabilidades

Producto/Vibe Coder diseña flujos, pantallas, estados y textos; prueba facilidad de uso con datos falsos. No decide por sí solo seguridad, permisos, dinero o modelo de datos.

Full-Stack revisa arquitectura, datos, reglas, seguridad, migraciones, pruebas, despliegues y aislamiento entre gimnasios.

## Reglas de ejecución

- Trabajar una tarjeta claramente definida a la vez.
- No ampliar el MVP silenciosamente.
- Pedir una sola decisión a la vez cuando sea indispensable.
- Hablar con el dueño en español simple y conciso.
- No decir que algo fue probado sin ejecutar una verificación concreta.
- No cambiar decisiones técnicas sin explicar el motivo y recibir aprobación.
- Agregar pruebas proporcionales al riesgo.
- Mantener diseños adaptables a móvil y escritorio.

## Terminado

Una tarea está terminada cuando cumple su alcance, maneja estados relevantes, respeta aislamiento y permisos, tiene verificación proporcional al riesgo, no expone secretos y deja actualizada la documentación afectada.

## Referencia

`TRELLO.md` contiene el backlog. Este archivo gobierna el producto, la arquitectura y la ejecución; `TRELLO.md` gobierna tareas y orden.
