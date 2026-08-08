# Contrato de verificación de trabajo delegado

Escrito 2026-08-07.

## El principio

**El agente que hace el trabajo no reporta su propio estado.**

Un reporte en prosa no es evidencia. Cuando un agente escribe `preflight: OK`, eso es una cadena de texto que tecleó, indistinguible de una que se inventó. No hay forma de auditarla, no hay forma de reproducirla, y creerla o no creerla es una decisión de fe.

La solución no es un prompt mejor.
La solución es **sacar al agente del camino de la evidencia**.

El agente produce un commit.
Un programa que el agente no ejecuta, no edita y no puede influir emite el veredicto.

Ese programa es `scripts/verify-package.mjs`.
Su contrato de entrada es `verification/packages.json`.
Su salida es `verification/results/<id>.json`, con el SHA del commit juzgado.

A partir de acá, **el reporte del agente vale cero y no se lee para decidir nada**. Se lee, si acaso, para saber dónde dice él que se trabó.

## La jerarquía de oráculos

De más confiable a menos. Usar siempre el más alto disponible.

| Nivel | Oráculo | Por qué se le cree |
|---|---|---|
| 1 | **CI en GitHub Actions** | Corre en un runner limpio, desde cero, sobre el commit publicado. Nadie local puede influirlo. Es el único oráculo válido para pgTAP: arranca la base desde las migraciones, sin contaminación. |
| 2 | **`verify-package --full`** | Crea un worktree aislado en el SHA exacto, hace `npm ci` y corre `preflight`. El directorio de trabajo del agente no puede afectarlo. |
| 3 | **`verify-package`** (estructural) | Puro git. Instantáneo. No ejecuta nada, pero decide todo lo que se puede decidir leyendo el diff. |
| — | **La prosa del agente** | Cero. No es evidencia. |

**El stack local de Supabase no es un oráculo.** Está compartido entre 12 worktrees y su esquema queda adelantado o atrasado respecto de cualquier rama. Un pgTAP verde ahí no prueba nada. El veredicto de base de datos lo da el job `db.yml` del CI.

## Lo que sí se decide por construcción

Cada uno de estos es un booleano que un programa resuelve. Cero juicio, cero "parece correcto".

| Verificación | Qué prueba |
|---|---|
| rama existe | Hay algo que juzgar |
| base correcta | El diff se calcula contra lo que creemos, no contra otra cosa |
| cantidad de commits | El alcance no se infló |
| commits sin firma de agente | Sin `Co-Authored-By`, sin "Generated with" |
| sin archivos fuera de alcance | Cada archivo tocado estaba declarado **de antemano** |
| migraciones existentes intactas | Solo se agregaron archivos; ninguna migración aplicada fue editada |
| timestamps de migración posteriores | La cadena de migraciones no se rompe |
| criterios de aceptación sin modificar | El ejecutor no aflojó las pruebas para que pasaran |
| sin em dash ni en dash | Regla del repositorio |
| rama no publicada | Nada llegó al remoto sin revisión |
| aserciones pgTAP aumentaron | Se agregó cobertura de verdad, contada del `plan(N)` de los archivos |
| `npm ci` | Las dependencias instalan desde cero |
| `npm run preflight` | typecheck, lint, tests y build en verde en un checkout limpio |
| `npm run test:db` | pgTAP en verde |

Ninguna de esas conclusiones depende de que el agente haya dicho la verdad.

## Lo que NO se puede decidir por construcción

Esto es la parte honesta, y es corta a propósito. Ningún harness la resuelve, y quien diga que sí, miente.

1. **Si el diseño es bueno.** "¿Esta migración está bien pensada?" no tiene oráculo. Una implementación fea que pasa todas las pruebas pasa todas las pruebas.
2. **Si la especificación era la correcta.** El verificador confirma que se cumplió lo pedido. No puede saber si lo pedido era lo que hacía falta. Un plan equivocado ejecutado impecablemente sigue siendo un resultado equivocado.
3. **Lo que no tiene prueba ejecutable.** Claridad de un runbook, calidad de los nombres, si un comentario explica lo correcto.
4. **Propiedades de seguridad no expresadas como prueba.** El verificador sabe que el `revoke` está en el diff. Que ese `revoke` sea suficiente contra todos los caminos de escritura es un razonamiento, no un booleano.

**Regla:** todo lo que caiga en esa zona se revisa a mano, se dice en voz alta que se revisó a mano, y **nunca** se reporta como verificado.

## El eslabón que falta y cómo se cierra

En el lote del 2026-08-07 hay una debilidad real que conviene nombrar:

**las pruebas de aceptación las escribió el mismo agente que escribió el código.**

Un agente que escribe su propia prueba puede escribir una que pase trivialmente. Que las 176 aserciones estén en verde prueba menos de lo que parece.

La corrección para el próximo lote, y es mecánica:

1. Las pruebas de aceptación se escriben **primero**, antes de que el ejecutor arranque, por alguien que no va a implementar.
2. Se verifica que esas pruebas **fallen** sobre `origin/main`. Una prueba que ya pasa antes del cambio no prueba nada.
3. Se registra el `sha256` de cada archivo de prueba en `frozenFiles` dentro de `packages.json`.
4. El ejecutor recibe una suite roja y su trabajo es ponerla verde **sin tocarla**.
5. `verify-package` compara los hashes. Si el ejecutor las modificó, el paquete falla, sin importar qué diga el resto.

Con eso, "las pruebas pasan" deja de ser una afirmación del ejecutor sobre su propio trabajo y pasa a ser un hecho sobre un contrato que no escribió.

## Cómo se usa

```bash
node scripts/verify-package.mjs --all
```

```bash
node scripts/verify-package.mjs P1 --full
```

Sin flags: estructural, instantáneo.
`--full`: agrega worktree aislado, `npm ci` y `preflight`.
`--with-db`: agrega `test:db`. Recordar que localmente el stack está contaminado; el veredicto bueno lo da el CI.

Exit code 1 si algo falla. Sirve para encadenarlo.

## El verificador también miente si no lo cuidás

Esto pasó el mismo día que se escribió este documento, y es la lección más útil del ejercicio.

La primera corrida de `--full` marcó **los seis paquetes en FAIL**, todos en `npm ci`.
Seis ramas independientes fallando idéntico no es seis fallas: es una falla del verificador.

Era eso. Node 24 en Windows rechaza ejecutar `npm.cmd` sin pasar por el intérprete de comandos, por el endurecimiento de CVE-2024-27980. El proceso nunca arrancó. El verificador lo reportó como `exit null` y lo contó como falla del código.

Dos correcciones, las dos ya aplicadas:

1. **Distinguir "el comando falló" de "el comando no arrancó".** Si `status` viene en `null`, el proceso no llegó a ejecutarse: eso es culpa del verificador y el reporte ahora lo dice con todas las letras (`EL VERIFICADOR NO PUDO EJECUTAR EL COMANDO`). Un verificador que confunde su propia rotura con un defecto del código es peor que no tener verificador, porque produce acusaciones falsas con apariencia de rigor.
2. **Nunca encadenar el verificador a `| tail`.** El exit code de una tubería es el del último comando, así que `verify-package ... | tail` devuelve 0 aunque el verificador haya salido 1. En esa primera corrida el harness informó "exit code 0" sobre una corrida con seis fallas. Si se necesita recortar la salida, guardar el exit code aparte.

La disciplina que esto exige: **cuando el veredicto es sorprendente, sospechar primero del instrumento.** Seis fallas idénticas, una falla en un módulo que nadie tocó, o un verde donde se esperaba rojo: todo eso se investiga antes de reportarlo como resultado.

## La regla de oro

Si una afirmación sobre el trabajo no está en la tabla de "se decide por construcción", entonces **no está verificada**, por más convincente que suene el reporte que la acompaña.

Decirlo así, explícitamente, cada vez.
