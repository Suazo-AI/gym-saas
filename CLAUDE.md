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

Queda fuera de esta autorización, porque no es lo que se autorizó:

- borrar ramas que no creé yo;
- reescribir historia ya publicada, incluido `push --force`;
- cambiar la configuración del repositorio o de sus reglas de protección;
- tocar el worktree de un agente que está trabajando.
