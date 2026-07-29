---
name: creating-trello
description: Crear o actualizar el tablero de Trello de FitManager desde Docs/trello-board-template.md. Úsala siempre que se hable de agregar, cambiar o sincronizar tarjetas, listas o checklists del tablero; de crear el tablero desde cero; de que "el tablero está desactualizado"; o cuando falle la autenticación con la API de Trello (401 invalid key / invalid token). También aplica cuando el usuario edite la plantilla del tablero y quiera reflejarlo en Trello.
---

# Tablero de Trello de FitManager

El tablero vive en **https://trello.com/b/8jUETslr** (`FitManager - Gym SaaS`, privado, workspace `Gym-saas`).

Dos archivos gobiernan cosas distintas, y confundirlos es el error más caro de este flujo:

| | Fuente de verdad de |
|---|---|
| `Docs/trello-board-template.md` | **contenido** de las tarjetas: título, descripción, etiquetas, checklists |
| Trello | **estado** del trabajo: en qué lista está cada tarjeta, responsable, fecha, qué ítems están marcados |

Por eso el script nunca edita ni borra lo que ya existe en Trello. Si reescribiera las tarjetas desde la plantilla, borraría el progreso real del equipo. Cuando el contenido de una tarjeta ya creada esté mal, se corrige **en Trello a mano**, y la plantilla se actualiza para que futuras recreaciones nazcan bien.

## Los dos modos

```bash
node scripts/trello/bootstrap-board.mjs --dry-run
```
Parsea la plantilla y muestra qué saldría. No toca la API ni necesita credenciales. **Corre esto siempre primero**, sobre todo después de editar la plantilla — es la forma barata de descubrir que un bullet quedó mal indentado.

```bash
node scripts/trello/bootstrap-board.mjs --board 8jUETslr
```
El caso normal. Lee el tablero, compara por nombre y agrega solo lo que falta. Si no falta nada, gasta 5 llamadas y no cambia nada. Es seguro correrlo las veces que sea.

```bash
node scripts/trello/bootstrap-board.mjs --workspace "Gym-saas" --name "Nombre"
```
Crea un tablero nuevo desde cero. Solo para empezar de nuevo o levantar un tablero de otro proyecto. Ojo: crea uno nuevo cada vez, así que si se corre dos veces quedan dos tableros.

Flags extra: `--only 00,01,04` limita a ciertas listas.

## Agregar o cambiar tarjetas

Se edita `Docs/trello-board-template.md` y se vuelve a correr con `--board`. El parser reconoce esta forma exacta:

```markdown
## Lista: 04 - Primer flujo vertical del MVP   ← lista

### Registrar miembro                          ← tarjeta

- Responsable: Frontend + Full-Stack.          ← va a la descripción
- Etiquetas: `FRONTEND`, `SUPABASE`, `MVP`.    ← etiquetas (con backticks)
- Checklist:                                   ← abre una checklist con ese nombre
  - Formulario validado.                       ← ítems (indentados con 2 espacios)
  - Detección de duplicados.
- Terminado cuando: ...                        ← vuelve a la descripción
```

Cualquier bullet que termine en `:` y tenga sub-bullets indentados se vuelve una checklist con ese nombre — por eso funcionan también `Incluye:`, `Requisitos:`, `Casos:`, `Mostrar:`. Un bullet que termina en `:` **sin** sub-bullets se trata como texto normal.

Las etiquetas válidas son las 11 de la plantilla (`PRODUCTO`, `VIBE`, `FRONTEND`, `SUPABASE`, `FULLSTACK`, `SEGURIDAD`, `QA`, `DEVOPS`, `MVP`, `DESPUÉS`, `BLOQUEADO`). Una etiqueta que no esté en esa lista genera un aviso y la tarjeta se crea sin ella.

**Trampa importante:** la comparación es por **título exacto**, en todo el tablero. Consecuencias:

- Renombrar una tarjeta en la plantilla y volver a correr **crea una segunda tarjeta**, no renombra la primera. Si se quiere renombrar, hacerlo en Trello y en la plantilla por separado.
- Una tarjeta movida a `10 - Terminado` no se recrea en su lista original. Eso es a propósito.

## Credenciales

El script las busca en dos lugares, en este orden:

1. Variables de entorno `TRELLO_KEY` y `TRELLO_TOKEN`.
2. `%USERPROFILE%\.claude\.trello.env`, con una línea `CLAVE=valor` cada una.

Ese archivo ya está creado y poblado, así que **normalmente no hay que hacer nada**: basta con correr el script. Vive fuera del repositorio a propósito — así no existe la ruta por la cual un secreto termine en un commit.

**Nunca** poner credenciales en un archivo del repo, ni imprimirlas en la salida, ni pegarlas en un chat. El script verifica `/members/me` antes de tocar nada, para no dejar un tablero a medias, y reporta de cuál de las dos fuentes las tomó.

### Formato correcto (esto ya costó una sesión entera)

- **API key**: 32 caracteres hex. Semipública por diseño — Trello no ofrece resetearla.
- **Token**: empieza con `ATTA` y mide ~76 caracteres. **No** es una cadena de 64 hex.
- Una cadena de **64 hex** en esa pantalla es el **Secret** de OAuth 1. No sirve como token y produce `401 invalid key`, que apunta al lado equivocado del problema.

Se genera abriendo, con la key real:

```
https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=<API_KEY>
```

`read,write` alcanza. El `scope=account` que sugiere Trello agrega lectura de correo y administración de Enterprises sin necesidad.

### Diagnosticar un 401

No adivinar cuál de las dos credenciales falla; preguntarle a la API:

| Sonda | Respuesta | Lectura |
|---|---|---|
| `/1/members/me?key=K` (sin token) | `400 invalid token` | la key **es válida** |
| `/1/members/me?key=K` (sin token) | `401 invalid key` | la key está mal |
| `/1/tokens/<T>?key=K` | `404 token not found` | esa cadena no es un token |

Si key y token tienen el formato correcto y aun así hay `401`, casi siempre es que el "token" es en realidad el Secret.

### Si un token queda expuesto

Si aparece en un chat, un log, un screenshot o un commit: revocarlo en `https://trello.com/<usuario>/account` → **Applications**, y generar uno nuevo. La key no hace falta rotarla porque sola no autoriza nada.

## Verificar después de correr

El script imprime `Listas nuevas / Tarjetas nuevas / Ya existían`. Cuando el cambio importa, confirmarlo contra la API en vez de confiar en la salida:

```bash
node -e '
const q = `key=${process.env.TRELLO_KEY}&token=${process.env.TRELLO_TOKEN}`;
const b = await (await fetch(`https://api.trello.com/1/boards/8jUETslr?${q}&lists=open&list_fields=name&cards=open&card_fields=name,idList,idLabels`)).json();
for (const l of b.lists) console.log(`${String(b.cards.filter(c=>c.idList===l.id).length).padStart(3)}  ${l.name}`);
console.log(`Total: ${b.cards.length} | sin etiqueta: ${b.cards.filter(c=>!c.idLabels.length).length}`);
'
```

Referencia esperada al día de hoy: 11 listas, 74 tarjetas, 66 checklists, 435 ítems, ninguna tarjeta sin etiqueta.

## Reglas del producto que el tablero debe respetar

`AGENTS.md` gobierna las reglas; el tablero gobierna el trabajo. Si una tarjeta contradice `AGENTS.md`, hay que detenerse y avisar, no implementar.

Dos decisiones cerradas que suelen colarse mal en tarjetas nuevas:

- **Moneda**: el MVP opera **solo en córdobas (NIO)**. Nada de selector de moneda ni conversión. La tasa C$36.60 por US$1 es solo para precios listados en USD (el precio del SaaS). El cobro en dólares vive en `09 - Después del MVP`.
- **Alcance**: una tarjeta nueva que no esté en el MVP va con etiqueta `DESPUÉS`, no se cuela en las listas de desarrollo.
