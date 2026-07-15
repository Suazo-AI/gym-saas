# Trello — SaaS para gimnasios

## Reglas del tablero

- Mercado inicial: gimnasios pequeños de Nicaragua, aproximadamente 25–100 miembros.
- Interfaz: español.
- Monedas: USD y NIO.
- Tasa inicial: C$36.50 por US$1; cada gimnasio puede cambiarla.
- Los cambios de tasa afectan solamente transacciones nuevas y quedan auditados.
- Roles iniciales: Dueño, Gerente, Recepcionista y Administrador de plataforma.
- Tecnología propuesta: ASP.NET Core MVC, Supabase/PostgreSQL y Bootstrap.
- Supabase será la plataforma principal para base de datos, autenticación y almacenamiento de imágenes.
- La aplicación ASP.NET Core se desplegará en un hosting separado.
- El Full-Stack aprueba seguridad, permisos, dinero, base de datos y despliegues.

## Etiquetas

- `PRODUCTO` — decisiones y validación del negocio.
- `VIBE` — experiencia, pantallas y textos.
- `FULLSTACK` — backend, base de datos y lógica.
- `SEGURIDAD` — autenticación, permisos y auditoría.
- `QA` — pruebas.
- `MVP` — obligatorio para el piloto.
- `DESPUÉS` — fuera de la primera versión.
- `BLOQUEADO` — necesita una decisión o dependencia.

## Lista: 00 — Decisiones pendientes

### Entrevistar 10 dueños de gimnasio

- Responsable: Producto
- Etiquetas: `PRODUCTO`, `MVP`
- Checklist:
  - Crear lista de 30 gimnasios.
  - Contactar al menos 20.
  - Entrevistar al menos 10 dueños o gerentes.
  - Registrar procesos actuales, dolores y palabras exactas.
  - Confirmar si el problema principal son pagos atrasados y control de miembros activos.
- Terminado cuando: existen notas comparables de 10 entrevistas.

### Definir acceso del miembro

- Responsable: Producto
- Etiquetas: `PRODUCTO`, `BLOQUEADO`
- Decisión: confirmar si el miembro tendrá cuenta propia en el MVP.
- Recomendación: no incluir portal del miembro en el primer piloto.

### Definir reglas de membresía

- Responsable: Producto + Full-Stack
- Etiquetas: `PRODUCTO`, `MVP`
- Checklist:
  - Plan mensual inicial.
  - Fecha de inicio y vencimiento.
  - Días de gracia.
  - Renovación manual o automática.
  - Congelamiento, cancelación y reactivación.
  - Descuentos y pagos parciales.
- Terminado cuando: cada estado y transición está escrito sin ambigüedad.

### Definir método de entrada

- Responsable: Producto
- Etiquetas: `PRODUCTO`, `BLOQUEADO`
- Decisión: búsqueda manual, código QR o ambos.
- Recomendación MVP: búsqueda rápida y QR opcional.

### Definir precio del SaaS

- Responsable: Producto
- Etiquetas: `PRODUCTO`
- Checklist:
  - Precio piloto.
  - Precio mensual normal.
  - Prueba gratuita.
  - Límites por miembros o sucursales.
  - Método de cobro al gimnasio.

## Lista: 01 — Descubrimiento

### Documentar proceso actual del gimnasio

- Responsable: Producto
- Etiquetas: `PRODUCTO`, `MVP`
- Checklist:
  - Registrar miembro.
  - Cobrar membresía.
  - Confirmar entrada.
  - Detectar vencidos.
  - Cerrar caja.
  - Crear reporte mensual.

### Definir éxito del piloto

- Responsable: Producto
- Etiquetas: `PRODUCTO`, `MVP`
- Métricas sugeridas:
  - Un gimnasio usa el sistema diariamente durante 30 días.
  - Al menos 80% de entradas se registran en el sistema.
  - Todos los pagos del periodo quedan registrados.
  - El dueño puede identificar morosos sin usar Excel.
  - No ocurre pérdida ni mezcla de datos entre gimnasios.

### Definir alcance cerrado del MVP

- Responsable: Producto + Full-Stack
- Etiquetas: `PRODUCTO`, `MVP`
- Incluye:
  - Gimnasios y usuarios.
  - Miembros.
  - Planes y membresías.
  - Pagos y recibos.
  - Entradas.
  - Caja básica.
  - Reportes esenciales.
  - USD/NIO y auditoría de tasa.
- No incluye:
  - Aplicación móvil nativa.
  - Rutinas y nutrición.
  - Acceso para entrenadores.
  - Nómina.
  - Contabilidad completa.
  - Control físico de puertas.
  - Inventario avanzado.

## Lista: 02 — Diseño Vibe Coder

### Crear mapa de navegación

- Responsable: Vibe Coder
- Etiquetas: `VIBE`, `MVP`
- Secciones:
  - Inicio.
  - Miembros.
  - Membresías.
  - Pagos.
  - Entradas.
  - Caja.
  - Reportes.
  - Personal y configuración.

### Diseñar registro de miembro

- Responsable: Vibe Coder
- Etiquetas: `VIBE`, `MVP`
- Campos mínimos:
  - Nombre y apellidos.
  - Teléfono.
  - Identificación opcional.
  - Fecha de nacimiento opcional.
  - Contacto de emergencia opcional.
  - Foto opcional.
  - Plan y fecha de inicio.
- Estados: cargando, error, duplicado y éxito.

### Diseñar cobro y recibo

- Responsable: Vibe Coder
- Etiquetas: `VIBE`, `MVP`
- Checklist:
  - Seleccionar miembro.
  - Mostrar deuda y vencimiento.
  - Elegir USD o NIO.
  - Mostrar tasa aplicada.
  - Seleccionar efectivo, transferencia u otro.
  - Confirmar pago.
  - Mostrar e imprimir recibo.

### Diseñar pantalla de entrada

- Responsable: Vibe Coder
- Etiquetas: `VIBE`, `MVP`
- Requisitos:
  - Uso rápido desde recepción.
  - Buscar por nombre, teléfono o código.
  - Mostrar activo, vencido o bloqueado.
  - Registrar entrada con una acción.

### Diseñar dashboard del dueño

- Responsable: Vibe Coder
- Etiquetas: `VIBE`, `MVP`
- Mostrar:
  - Miembros activos.
  - Membresías por vencer.
  - Morosos.
  - Ingresos del día y mes.
  - Entradas del día.

### Escribir textos en español

- Responsable: Vibe Coder
- Etiquetas: `VIBE`, `MVP`
- Regla: lenguaje corto, claro y consistente; no usar términos técnicos.

### Probar prototipo con usuarios

- Responsable: Vibe Coder + Producto
- Etiquetas: `VIBE`, `QA`
- Checklist:
  - Dos recepcionistas completan registro, cobro y entrada.
  - Dos dueños encuentran morosos e ingresos.
  - Registrar confusiones y tiempo por tarea.

## Lista: 03 — Base técnica Full-Stack

### Crear solución ASP.NET Core MVC

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `MVP`
- Checklist:
  - Estructura por capas o módulos.
  - Configuración por ambiente.
  - Manejo central de errores.
  - Logging sin datos sensibles.
  - Bootstrap y diseño adaptable.

### Configurar Supabase/PostgreSQL y migraciones

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `MVP`
- Checklist:
  - Entity Framework Core con proveedor PostgreSQL.
  - Proyecto de Supabase separado para desarrollo.
  - Migraciones versionadas.
  - Datos semilla para desarrollo.
  - Índices y restricciones.
  - Estrategia de respaldo y restauración.

### Diseñar multi-tenancy

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `SEGURIDAD`, `MVP`
- Requisitos:
  - Cada registro comercial pertenece a un gimnasio.
  - Filtros obligatorios por `GymId`.
  - El administrador de plataforma opera fuera del contexto normal con auditoría.
  - Pruebas que impidan ver datos de otro gimnasio.

### Implementar autenticación

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `SEGURIDAD`, `MVP`
- Checklist:
  - Inicio y cierre de sesión.
  - Contraseñas seguras.
  - Recuperación de acceso.
  - Bloqueo temporal por intentos.
  - Cookies seguras y protección CSRF.

### Implementar roles y permisos

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `SEGURIDAD`, `MVP`
- Matriz inicial:
  - Dueño: acceso completo a su gimnasio.
  - Gerente: operación y reportes; sin propiedad de la cuenta.
  - Recepcionista: miembros, cobros y entradas; reportes limitados.
  - Administrador de plataforma: gimnasios, soporte y auditoría.

### Implementar auditoría

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `SEGURIDAD`, `MVP`
- Auditar:
  - Tasas de cambio.
  - Pagos anulados o corregidos.
  - Cambios de membresía.
  - Cambios de permisos.
  - Acciones del administrador de plataforma.

## Lista: 04 — Desarrollo MVP

### Módulo de gimnasios

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `MVP`
- Incluye: alta, estado, configuración, moneda preferida y tasa actual.

### Módulo de personal

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `SEGURIDAD`, `MVP`
- Incluye: invitar, activar, desactivar y asignar rol.

### Módulo de miembros

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `MVP`
- Incluye: alta, edición, búsqueda, estado, historial y foto opcional.

### Módulo de planes y membresías

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `MVP`
- Incluye: planes, precios, vigencia, estados, renovación y cancelación.

### Módulo de pagos

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `SEGURIDAD`, `MVP`
- Requisitos:
  - No usar números flotantes para dinero.
  - Guardar monto, moneda y tasa aplicada.
  - No recalcular transacciones anteriores al cambiar la tasa.
  - Correcciones mediante anulación auditada, no borrado.
  - Recibo único por pago.

### Módulo de entradas

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `MVP`
- Incluye: búsqueda, validación de membresía, registro y consulta diaria.

### Caja básica

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `MVP`
- Incluye: apertura, movimientos, totales por moneda y cierre.

### Reportes esenciales

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `MVP`
- Reportes:
  - Miembros activos.
  - Membresías vencidas o próximas a vencer.
  - Pagos por periodo y moneda.
  - Entradas por periodo.
  - Cierre de caja.

### Exportar datos

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `MVP`
- Incluye: CSV de miembros y pagos filtrado por gimnasio.

## Lista: 05 — Pruebas y seguridad

### Pruebas automáticas críticas

- Responsable: Full-Stack
- Etiquetas: `QA`, `SEGURIDAD`, `MVP`
- Casos:
  - Separación entre gimnasios.
  - Permisos por rol.
  - Cálculo USD/NIO.
  - Cambio de tasa sin modificar pagos viejos.
  - Renovación y vencimiento.
  - Anulación de pagos.
  - Cierre de caja.

### Pruebas de recorrido completo

- Responsable: Full-Stack + Vibe Coder
- Etiquetas: `QA`, `MVP`
- Recorridos:
  - Crear gimnasio y dueño.
  - Crear recepcionista.
  - Registrar miembro.
  - Cobrar membresía.
  - Registrar entrada.
  - Encontrar moroso.
  - Cerrar caja.

### Revisión de seguridad

- Responsable: Full-Stack
- Etiquetas: `SEGURIDAD`, `QA`, `MVP`
- Checklist:
  - Autorización en servidor, no solo botones ocultos.
  - Validación de archivos e imágenes.
  - Protección contra inyección, XSS y CSRF.
  - Secretos fuera del repositorio.
  - HTTPS.
  - Registro de auditoría protegido.
  - Restauración de respaldo probada.

### Prueba de usabilidad

- Responsable: Vibe Coder
- Etiquetas: `VIBE`, `QA`, `MVP`
- Meta: una recepcionista nueva completa registro, cobro y entrada sin ayuda.

## Lista: 06 — Piloto

### Preparar ambiente de demostración

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `MVP`
- Requisitos: Supabase de desarrollo y hosting temporal para ASP.NET Core, sin datos reales sensibles.

### Preparar ambiente piloto

- Responsable: Full-Stack
- Etiquetas: `FULLSTACK`, `SEGURIDAD`, `MVP`
- Requisitos:
  - Hosting confiable.
  - SSL.
  - Backups automáticos.
  - Monitoreo básico.
  - Cuenta separada de producción.

### Incorporar primer gimnasio

- Responsable: Producto + Full-Stack
- Etiquetas: `PRODUCTO`, `MVP`
- Checklist:
  - Crear gimnasio y dueño.
  - Configurar moneda y tasa.
  - Importar miembros si corresponde.
  - Capacitar dueño y recepción.
  - Definir canal de soporte.

### Ejecutar piloto de 30 días

- Responsable: Producto
- Etiquetas: `PRODUCTO`, `QA`, `MVP`
- Checklist:
  - Revisión diaria durante primera semana.
  - Revisión semanal después.
  - Registrar errores y solicitudes.
  - Medir criterios de éxito.
  - No agregar funciones fuera del MVP durante el piloto salvo bloqueo crítico.

## Lista: 07 — Lanzamiento

### Corregir bloqueadores del piloto

- Responsable: Full-Stack + Vibe Coder
- Etiquetas: `QA`, `MVP`
- Terminado cuando: no quedan fallos críticos de seguridad, dinero o pérdida de datos.

### Preparar operación comercial

- Responsable: Producto
- Etiquetas: `PRODUCTO`
- Checklist:
  - Precio y condiciones.
  - Contrato y política de privacidad.
  - Proceso de ventas.
  - Proceso de onboarding.
  - Soporte y tiempos de respuesta.
  - Cancelación y exportación de datos.

### Lanzar a primeros gimnasios

- Responsable: Producto + Full-Stack
- Etiquetas: `PRODUCTO`, `FULLSTACK`
- Estrategia: incorporar pocos gimnasios, estabilizar y luego aumentar ventas.

## Lista: 08 — Después del MVP

### Portal del miembro

- Etiquetas: `DESPUÉS`

### Acceso para entrenadores

- Etiquetas: `DESPUÉS`

### Rutinas, medidas y progreso

- Etiquetas: `DESPUÉS`

### Inventario y mantenimiento de máquinas

- Etiquetas: `DESPUÉS`

### Recordatorios por WhatsApp

- Etiquetas: `DESPUÉS`

### Aplicación móvil

- Etiquetas: `DESPUÉS`

### Integración con control de acceso físico

- Etiquetas: `DESPUÉS`

## Lista: 09 — Terminado

Mover una tarjeta aquí solamente cuando:

- Cumple sus criterios de terminado.
- Fue revisada por el responsable apropiado.
- Tiene pruebas proporcionales al riesgo.
- No rompe separación entre gimnasios ni permisos.
- La documentación necesaria fue actualizada.

## Orden recomendado de ejecución

1. Entrevistas y decisiones pendientes.
2. Alcance cerrado del MVP.
3. Diseño de los cuatro flujos principales.
4. Base técnica, multi-tenancy, autenticación y permisos.
5. Miembros, membresías, pagos y entradas.
6. Caja y reportes.
7. Pruebas, seguridad y respaldo.
8. Demostración, piloto y lanzamiento.
