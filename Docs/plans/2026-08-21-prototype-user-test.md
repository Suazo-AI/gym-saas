# Prueba del prototipo con usuarios

- Fecha de preparación: 2026-08-21.
- Tarjeta: [Probar prototipo con usuarios](https://trello.com/c/fLzDjJES/19-probar-prototipo-con-usuarios).
- Responsable: Vibe Coder + Producto.
- Estado: las mejoras A1, A2, A3 y A5 están aplicadas; las sesiones reales siguen pendientes.
- Evidencia real: 0 de 4 sesiones.
- Checklist de Trello: 0 de 5 puntos terminados.

Este archivo no cierra la tarjeta.
La tarjeta solo termina después de cuatro sesiones reales y un acuerdo de cambios.

## Resultado requerido

- Dos recepcionistas completan registro, cobro y entrada.
- Dos dueños encuentran morosos e ingresos.
- Se registran todas las confusiones observadas.
- Se registra el tiempo de cada tarea.
- Se priorizan las correcciones antes del desarrollo final.
- El informe final contiene problemas observados y cambios acordados.

## Bloqueo actual

Faltan dos recepcionistas y dos dueños o gerentes disponibles para las sesiones.
También falta permiso para invitarlos o enviarles mensajes.
No se puede sustituir esta evidencia con agentes, tests automáticos o sesiones simuladas.

## Recorrido automatizado del 2026-08-21

Este recorrido usó AXI contra la aplicación local con datos falsos.
No fue una sesión con personas y no cambia la evidencia real de 0 de 4 sesiones.
La cuenta local de administración representó recepción porque, ese día, los datos de prueba no incluían una cuenta recepcionista.
Ese vacío es el hallazgo A3 y ya está corregido en `supabase/seed.sql`.
La misma cuenta de dueño ejecutó los dos recorridos de dueño.

| Recorrido | Tarea | Resultado | Tiempo | Evidencia visible |
|---|---|---|---|---|
| R1 escritorio | Registro sin pago inicial | Completada | 69.808 s | El miembro `UX-R1-20260821-1459` apareció con plan y cargo de NIO 900. |
| R1 escritorio | Pago en efectivo | Completada | 47.740 s | Se creó y abrió el recibo `R-E476763DF8` por NIO 900. |
| R1 escritorio | Entrada manual | Completada después de reparar el entorno | 255.849 s | Aparecieron `Permitida` y el evento manual en el historial. El tiempo incluye el diagnóstico y la migración local. |
| R2 móvil alterno | Registro con pago inicial | Completada | 76.912 s | El miembro `UX-R2-20260821-1517` apareció con plan y saldo 0. Esta variante no siguió la regla oficial de pago separado. |
| O1 simulado | Encontrar morosos | Completada | 36.998 s | El filtro mostró a Jorge Ramirez con NIO 900 vencidos. |
| O2 simulado | Encontrar ingresos | Completada | 35.988 s | El mes mostró NIO 1800 y no mostró una fila USD. El dashboard mostró USD 0.00. |

`R-T4` no se ejecutó porque necesita interpretación y palabras de una persona real.
`R2` no ejecutó el pago separado ni la entrada.
Los recorridos `O1` y `O2` no representan dos participantes distintos.

### Observaciones del agente

Estas observaciones orientan la siguiente mejora.
No reemplazan hallazgos humanos ni cambios acordados.

| ID | Observación verificada | Prioridad sugerida | Cambio propuesto |
|---|---|---|---|
| A1 | La pantalla `/payments` seleccionó por defecto el cargo de Jorge Ramirez. El pago nuevo era para otra persona. | Crítica | Iniciar sin cargo seleccionado y exigir buscar o confirmar al miembro antes de habilitar el cobro. |
| A2 | Con emulación de 390 por 844, la barra lateral midió 719 px. El título principal empezó en 792 px. El primer campo del alta empezó en 1032 px y el botón final en 2845 px. | Alta | Cambiar la barra lateral por un encabezado o menú plegable en móvil. |
| A3 | Los datos locales no tienen una cuenta recepcionista. La cuenta administrativa deja sin probar los permisos reales de recepción. | Alta | Agregar una cuenta local con el rol y los permisos exactos de recepción. |
| A4 | La base local tenía pendiente `20260810200000_overdue_access_policy.sql`. Esto bloqueó la selección para entrada hasta aplicarla. | Alta | Hacer que el preflight falle si existe una migración local pendiente. |
| A5 | En móvil, el bloque facial queda entre sucursal y plan. El plan empezó 721 px después del selector de sucursal. | Media | Mover el enrolamiento facial a un paso opcional después de crear el miembro. |

## Correcciones aplicadas el 2026-08-21

- A1 corregida: `/payments` inicia sin cargo, monto ni método seleccionados.
- El cobro queda bloqueado hasta seleccionar el cargo y el método.
- La pantalla confirma miembro, vencimiento y saldo antes de habilitar el cobro.
- A2 corregida: la barra lateral completa se oculta a 390 por 844.
- Un encabezado móvil de 69 px contiene el menú plegable.
- El documento mide 390 px y no tiene desborde horizontal.
- El título empieza en 142 px y el primer campo empieza en 382 px.
- A3 corregida el 2026-08-22: `supabase/seed.sql` crea la cuenta local `reception@fitmanager.local`.
- La cuenta pertenece a Impulso Fitness con código de empleado `REC-LOCAL` y estado `active`.
- Tiene el rol de sistema `receptionist`, el mismo que crea `private.bootstrap_new_gym()` para todo gimnasio nuevo.
- No se inventó ningún rol ni ningún permiso: el rol y sus 15 permisos vienen de `20260802120000_permissions_realignment.sql`.
- Permisos efectivos: `gym.read`, `members.read`, `members.manage`, `memberships.read`, `memberships.manage`, `payments.read`, `payments.manage`, `entries.read`, `entries.manage`, `faces.read`, `faces.verify`, `alerts.read`, `dashboard.read`, `media.read`, `media.manage`.
- No tiene `staff.read`, `staff.manage`, `roles.manage`, `income.read`, `income.manage`, `audit.read`, `billing.read`, `billing.manage` ni `faces.manage`.
- Con esa cuenta, recepción ya no ve personal, roles, ingresos, auditoría ni facturación SaaS.
- La contraseña local sigue siendo la falsa `LocalDev123!`, igual que las otras cuentas del seed.
- Bug encontrado al verificar A3: el seed no se podía volver a correr sobre una base ya poblada.
- `member_payment_allocations` tiene un trigger `before insert` y en PostgreSQL un trigger BEFORE corre antes de que `on conflict do nothing` descarte la fila.
- La segunda corrida abortaba con `Allocated amount exceeds payment amount`, y como el seed es un solo `begin`/`commit`, ninguna fila nueva llegaba nunca.
- Sin ese arreglo la cuenta de recepción no podía entrar a la base local compartida, así que se corrigió en el mismo commit con un guardia `where not exists`.
- A5 corregida: el acceso facial está después de membresía y pago.
- El acceso facial está cerrado por defecto y se identifica como opcional.
- Los campos de nombre, apellido, teléfono y correo incluyen datos de autocompletado.

## Verificación de las correcciones

- A3: el seed completo corrió contra la base local dentro de una transacción con `rollback`, con `psql` en salida 0.
- Esa corrida en seco comprobó los 15 permisos exactos del rol `receptionist` y la ausencia de `staff.*`, `roles.manage`, `income.*`, `audit.read`, `billing.*` y `faces.manage`.
- Después se aplicó el seed de verdad a la base local, también en salida 0, y solo insertó cuatro filas nuevas: usuario Auth, identidad, `gym_users` y `gym_user_roles`.
- No se reinició la base local y ninguna fila existente cambió.
- Las pantallas visibles para recepción quedaron en `entries`, `dashboard`, `members`, `memberships`, `payments`, `facial_access`, `alerts` y `settings`.
- Recepción no ve `income`, `staff`, `roles`, `saas_billing` ni `audit`.
- La prueba completa del workspace pasó con 88 archivos y 316 pruebas.
- TypeScript pasó sin errores.
- ESLint pasó sin errores.
- La compilación de producción terminó correctamente.
- El navegador cargó `/members/new` con estado HTTP 200.
- La consola no mostró errores después de la corrección final.
- No se creó ningún pago durante esta verificación.
- La herramienta de captura de AXI no escribió archivos de imagen.
- La evidencia visual guardada sigue pendiente por esa limitación de herramienta.

La migración pendiente se aplicó solo a la base local.
La revisión final mostró `PENDING_LOCAL_MIGRATIONS=0`.
La consola del navegador no mostró errores en el pase móvil final.
AXI reportó rutas de capturas, pero no escribió los archivos.
Por eso, este recorrido conserva evidencia textual y no afirma evidencia visual guardada.

## Artefactos que se prueban

- Flujo real de registro: `/members/new`.
- Flujo real de cobro: `/payments`.
- Flujo real de entrada: `/entries`.
- Consulta real de morosos: `/members`.
- Consulta real de ingresos: `/income`.
- Prototipo aprobado de recepción: `.stitch/reception-v2/states/_base-v2.html`.
- Estado de gracia: `.stitch/reception-v2/states/grace.html`.
- Estado bloqueado: `.stitch/reception-v2/states/denied.html`.

## Preparación del entorno

1. Usar solo un entorno local o de prueba.
2. Usar datos falsos.
3. No mostrar otros gimnasios, secretos ni datos personales reales.
4. Usar una ventana de 1280 por 1024 o mayor.
5. Confirmar que Docker Desktop está activo.
6. Confirmar que Supabase local está activo y tiene los datos de prueba.
7. Iniciar FitManager en `http://localhost:3000`.
8. Confirmar una sucursal activa, un plan activo y un método de pago en efectivo.
9. Confirmar al menos un miembro moroso y pagos en NIO y USD durante el mes actual.
10. Iniciar la sesión correcta antes de entregar el control al participante.
11. Para los recorridos `R1` y `R2`, iniciar sesión con `reception@fitmanager.local`, no con una cuenta de administración.

No reiniciar la base local si contiene trabajo que debe conservarse.

## Reglas de la sesión

- Probar el producto, no a la persona.
- Pedir que la persona piense en voz alta.
- Leer la tarea sin explicar dónde debe hacer clic.
- Empezar el tiempo al terminar de leer la tarea.
- Detener el tiempo cuando aparece la confirmación visible.
- Esperar 60 segundos antes de dar ayuda.
- Registrar cada ayuda.
- Registrar palabras exactas cuando exista confusión.
- No grabar pantalla, rostro ni voz sin permiso.
- Usar identificadores `R1`, `R2`, `O1` y `O2` en las notas.

## Texto inicial

Gracias por ayudarnos.
Hoy probamos FitManager, no tu capacidad.
Di en voz alta qué esperas y qué te confunde.
Puedes detener la sesión cuando quieras.

## Tareas para cada recepcionista

Preparar una ficha falsa distinta para `R1` y `R2`.
Usar un código como `UX-R1-20260821-1530` o `UX-R2-20260821-1600`.

### R-T1. Registrar miembro

Una persona nueva quiere iniciar hoy.
Regístrala con la ficha entregada, el plan indicado y su primer cargo.
No registres el pago dentro del alta.

Criterio de éxito: el miembro aparece en la base con el plan y el cargo pendiente correctos.

### R-T2. Cobrar

La misma persona paga en efectivo el total pendiente.
Registra el pago y muestra el recibo.

Criterio de éxito: aparece un recibo y el cargo deja de estar pendiente.

### R-T3. Registrar entrada

La misma persona llega al gimnasio.
Encuéntrala, confirma su estado y registra su entrada.

Criterio de éxito: aparece una confirmación y el evento queda en el historial.

### R-T4. Entender los estados

Mostrar `grace.html` y preguntar: `¿Puede entrar y qué harías ahora?`.
Mostrar `denied.html` y hacer la misma pregunta.

Criterio de éxito: la persona distingue permiso, gracia y bloqueo sin ayuda.

## Tareas para cada dueño o gerente

### O-T1. Encontrar morosos

El gimnasio necesita cobrar las deudas vencidas.
Encuentra los miembros morosos y explica cuál revisarías primero.

Criterio de éxito: la persona aplica el filtro correcto y encuentra la deuda visible.

### O-T2. Encontrar ingresos

El dueño quiere ver los ingresos del mes actual.
Encuentra los totales en NIO y USD.

Criterio de éxito: la persona llega al rango correcto y lee ambos totales sin ayuda.

## Registro de participantes

| ID | Rol | Experiencia con software de gimnasio | Fecha y hora | Navegador y tamaño | Aceptó participar | Sesión terminada |
|---|---|---|---|---|---|---|
| R1 | Recepción | Pendiente | Pendiente | Pendiente | Pendiente | No |
| R2 | Recepción | Pendiente | Pendiente | Pendiente | Pendiente | No |
| O1 | Dueño o gerente | Pendiente | Pendiente | Pendiente | Pendiente | No |
| O2 | Dueño o gerente | Pendiente | Pendiente | Pendiente | Pendiente | No |

## Registro de tareas

Usar `Sin ayuda`, `Con ayuda` o `No completada`.

| Participante | Tarea | Resultado | Tiempo | Pasos incorrectos | Ayudas | Evidencia visible | Nota breve |
|---|---|---|---|---|---|---|---|
| R1 | R-T1 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| R1 | R-T2 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| R1 | R-T3 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| R1 | R-T4 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| R2 | R-T1 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| R2 | R-T2 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| R2 | R-T3 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| R2 | R-T4 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| O1 | O-T1 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| O1 | O-T2 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| O2 | O-T1 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| O2 | O-T2 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## Registro de confusiones

| ID | Participante | Tarea | Qué intentó | Palabras exactas | Resultado | Frecuencia |
|---|---|---|---|---|---|---|
| C1 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## Hallazgos y prioridad

- Crítica: impide terminar o crea riesgo de dinero, seguridad o datos.
- Alta: necesita ayuda o confunde a dos o más personas.
- Media: retrasa la tarea, pero la persona se recupera sola.
- Baja: afecta claridad o acabado sin bloquear la tarea.

| ID | Problema observado | Evidencia | Prioridad | Cambio propuesto | Responsable | Estado |
|---|---|---|---|---|---|---|
| F1 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## Cambios acordados

Producto y desarrollo deben revisar los hallazgos juntos.
Cada cambio aceptado necesita responsable y tarjeta antes del desarrollo final.

| Hallazgo | Decisión | Cambio acordado | Responsable | Tarjeta | Orden |
|---|---|---|---|---|---|
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## Informe final

- Sesiones terminadas: 0 de 4.
- Tareas sin ayuda: pendiente.
- Tareas con ayuda: pendiente.
- Tareas no completadas: pendiente.
- Tiempo más lento: pendiente.
- Problemas críticos: pendiente.
- Problemas altos: pendiente.
- Conclusión: pendiente de sesiones reales.

## Criterio de cierre

- [ ] Dos recepcionistas completaron registro, cobro y entrada.
- [ ] Dos dueños o gerentes encontraron morosos e ingresos.
- [ ] Todas las confusiones observadas quedaron registradas.
- [ ] Cada tarea tiene un tiempo registrado.
- [ ] Las correcciones quedaron priorizadas y los cambios fueron acordados.

No marcar la tarjeta como terminada mientras una casilla siga abierta.
