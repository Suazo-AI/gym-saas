@AGENTS.md

# Permisos de Git y GitHub para Claude

Autorización permanente dada por Jason el 2026-08-08.
No hace falta volver a pedirla caso por caso.

Puedo hacer por mi cuenta, sin preguntar:

- crear ramas y worktrees de git;
- crear commits;
- hacer push;
- abrir Pull Requests;
- mergear.

**La condición es una sola y no se negocia: todo tiene que estar en verde.**
Verde significa el CI completo de GitHub sobre el commit que se va a mergear.
No cuenta una corrida local, no cuenta el veredicto estructural de
`scripts/verify-package.mjs`, y no cuenta mi lectura del diff.
Si un check está rojo, pendiente o salteado, no se mergea y se avisa.

Ampliado el 2026-08-08, con estas palabras de Jason: "tenés permiso para todo".
Eso incluye la configuración del repositorio.
Ya se usó para habilitar `allow_auto_merge`, que estaba apagado y por eso fallaba
el interruptor de auto-merge de su cliente.

**Auto-merge por defecto.**
Al abrir un PR, dejarlo armado en el mismo momento:

```bash
gh pr merge <n> --merge --auto --delete-branch
```

Esperar el verde a mano no agrega ninguna garantía, porque la condición la
evalúa GitHub igual. Solo agrega una vuelta y el riesgo de que la base avance
mientras tanto y el PR deje de ser mergeable.
Si eso pasa: `gh pr update-branch <n>` y volver a armarlo.

Queda fuera, y no por falta de permiso sino porque destruye trabajo sin red:

- reescribir historia ya publicada, incluido `push --force`;
- borrar ramas con trabajo sin mergear;
- tocar el worktree de un agente que está trabajando.

Si alguna de esas tres hace falta de verdad, se avisa primero y se explica qué
se pierde. No es pedir permiso: es dejar registro antes de un acto irreversible.
