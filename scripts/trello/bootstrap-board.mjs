#!/usr/bin/env node
/**
 * Crea el tablero de Trello de FitManager a partir de Docs/trello-board-template.md
 *
 * Uso:
 *   set TRELLO_KEY / TRELLO_TOKEN en el entorno (nunca en el repositorio)
 *   node scripts/trello/bootstrap-board.mjs --dry-run
 *   node scripts/trello/bootstrap-board.mjs --name "FitManager - MVP"
 *   node scripts/trello/bootstrap-board.mjs --workspace gymsaas
 *   node scripts/trello/bootstrap-board.mjs --only 00,01,02,03,04
 *   node scripts/trello/bootstrap-board.mjs --board 8jUETslr   # agrega lo que falte
 *
 * Sin --board crea un tablero nuevo. Con --board reutiliza el existente y solo
 * agrega listas y tarjetas que aún no están, comparando por nombre. Nunca borra
 * ni edita lo que ya existe: el estado del trabajo vive en Trello, no aquí.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const TEMPLATE = resolve(HERE, '../../Docs/trello-board-template.md')

// --- argumentos -------------------------------------------------------------

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}
const DRY_RUN = argv.includes('--dry-run')
const BOARD_NAME = flag('name', 'FitManager - Gym SaaS')
/** Nombre corto o id del Workspace. Sin esto el tablero cae en el espacio personal. */
const WORKSPACE = flag('workspace', null)
/** shortLink o id de un tablero existente. Con esto solo se agrega lo que falta. */
const BOARD = flag('board', null)
const ONLY = flag('only', null)?.split(',').map((s) => s.trim())

/**
 * Credenciales: primero el entorno, y si no están, un archivo fuera del
 * repositorio para no depender de reescribirlas en cada terminal nueva.
 * Vive en el perfil del usuario justamente para que nunca pueda commitearse.
 */
const CREDS_FILE = resolve(
  process.env.USERPROFILE || process.env.HOME || '.',
  '.claude/.trello.env'
)

function loadCreds() {
  let key = process.env.TRELLO_KEY
  let token = process.env.TRELLO_TOKEN
  if (key && token) return { key, token, from: 'entorno' }

  try {
    for (const line of readFileSync(CREDS_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?(TRELLO_KEY|TRELLO_TOKEN)\s*=\s*"?([^"\s]+)"?/)
      if (!m) continue
      if (m[1] === 'TRELLO_KEY') key ||= m[2]
      else token ||= m[2]
    }
    if (key && token) return { key, token, from: CREDS_FILE }
  } catch {
    // el archivo es opcional
  }
  return { key, token, from: null }
}

const { key: KEY, token: TOKEN, from: CREDS_FROM } = loadCreds()

if (!DRY_RUN && (!KEY || !TOKEN)) {
  console.error(
    'Faltan TRELLO_KEY y TRELLO_TOKEN.\n\n' +
      'Opción 1, solo para esta terminal:\n' +
      '  $env:TRELLO_KEY = "..."; $env:TRELLO_TOKEN = "..."\n\n' +
      `Opción 2, permanente — crea ${CREDS_FILE} con:\n` +
      '  TRELLO_KEY=...\n  TRELLO_TOKEN=...\n\n' +
      'Ese archivo está fuera del repositorio, así que no puede terminar en un commit.\n' +
      'Usa --dry-run para revisar el resultado sin credenciales.'
  )
  process.exit(1)
}

// --- parseo de la plantilla -------------------------------------------------

/** Colores disponibles en Trello para las etiquetas de la plantilla. */
const LABEL_COLORS = {
  PRODUCTO: 'purple',
  VIBE: 'pink',
  FRONTEND: 'blue',
  SUPABASE: 'green',
  FULLSTACK: 'sky',
  SEGURIDAD: 'red',
  QA: 'yellow',
  DEVOPS: 'lime',
  MVP: 'orange',
  'DESPUÉS': 'black',
  BLOQUEADO: 'red',
}

/**
 * Convierte el markdown en { lists: [{ code, name, cards: [...] }] }.
 *
 * - `## Lista: NN - Nombre`  -> lista
 * - `### Titulo`             -> tarjeta
 * - `- Etiquetas: \`A\`, \`B\`` -> etiquetas de la tarjeta
 * - `- Seccion:` + viñetas indentadas -> checklist con ese nombre
 * - el resto de las viñetas -> descripción
 */
function parseTemplate(md) {
  const lines = md.split(/\r?\n/)
  const lists = []
  let list = null
  let card = null
  let group = null // checklist abierta por una viñeta "- Algo:"

  const closeGroup = () => {
    if (group && group.items.length === 0 && card) {
      // "- Algo:" sin sub-viñetas: era texto normal, no una checklist
      card.descLines.push(`- ${group.name}:`)
      group = null
    } else if (group) {
      group = null
    }
  }

  for (const raw of lines) {
    const listMatch = raw.match(/^## Lista:\s*(\S+)\s*-\s*(.+)$/)
    if (listMatch) {
      closeGroup()
      card = null
      list = { code: listMatch[1], name: `${listMatch[1]} - ${listMatch[2].trim()}`, cards: [] }
      lists.push(list)
      continue
    }

    if (raw.startsWith('## ')) {
      // otra sección de nivel 2 (reglas, etiquetas, orden): fuera del tablero
      closeGroup()
      card = null
      list = null
      continue
    }

    if (!list) continue

    const cardMatch = raw.match(/^###\s+(.+)$/)
    if (cardMatch) {
      closeGroup()
      card = { name: cardMatch[1].trim(), labels: [], descLines: [], checklists: [] }
      list.cards.push(card)
      continue
    }

    if (!card) continue

    const nested = raw.match(/^\s{2,}-\s+(.*)$/)
    if (nested) {
      if (group) group.items.push(nested[1].trim())
      else card.descLines.push(`- ${nested[1].trim()}`)
      continue
    }

    const bullet = raw.match(/^-\s+(.*)$/)
    if (bullet) {
      const text = bullet[1].trim()

      const labels = text.match(/^Etiquetas:\s*(.+?)\.?$/)
      if (labels) {
        closeGroup()
        card.labels = [...labels[1].matchAll(/`([^`]+)`/g)].map((m) => m[1])
        continue
      }

      const heading = text.match(/^([^:]+):$/)
      if (heading) {
        closeGroup()
        group = { name: heading[1].trim(), items: [] }
        card.checklists.push(group)
        continue
      }

      closeGroup()
      card.descLines.push(`- ${text}`)
      continue
    }

    if (raw.trim() === '') closeGroup()
  }

  closeGroup()

  for (const l of lists) {
    for (const c of l.cards) {
      c.checklists = c.checklists.filter((g) => g.items.length > 0)
      c.desc = c.descLines.join('\n').trim()
      delete c.descLines
    }
  }

  return lists
}

// --- cliente Trello ---------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let calls = 0
async function api(method, path, params = {}) {
  calls++
  const url = new URL(`https://api.trello.com/1${path}`)
  url.searchParams.set('key', KEY)
  url.searchParams.set('token', TOKEN)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { method })
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1))
      continue
    }
    if (!res.ok) {
      throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`)
    }
    await sleep(120) // ~50 req / 10 s, holgado frente al límite de Trello
    return res.json()
  }
  throw new Error(`${method} ${path}: rate limit persistente`)
}

// --- ejecución --------------------------------------------------------------

const lists = parseTemplate(readFileSync(TEMPLATE, 'utf8')).filter(
  (l) => !ONLY || ONLY.includes(l.code)
)

const totals = {
  lists: lists.length,
  cards: lists.reduce((n, l) => n + l.cards.length, 0),
  checklists: lists.reduce((n, l) => n + l.cards.reduce((m, c) => m + c.checklists.length, 0), 0),
  items: lists.reduce(
    (n, l) =>
      n + l.cards.reduce((m, c) => m + c.checklists.reduce((k, g) => k + g.items.length, 0), 0),
    0
  ),
}

if (DRY_RUN) {
  for (const l of lists) {
    console.log(`\n== ${l.name}  (${l.cards.length} tarjetas)`)
    for (const c of l.cards) {
      const chk = c.checklists.map((g) => `${g.name}:${g.items.length}`).join(' ')
      console.log(`   - ${c.name}  [${c.labels.join(', ')}]  ${chk}`)
    }
  }
  console.log(`\nResumen: ${JSON.stringify(totals)}`)
  console.log('Dry run: no se llamó a la API de Trello.')
  process.exit(0)
}

// Verificar credenciales antes de crear nada, para no dejar un tablero a medias.
try {
  const me = await api('GET', '/members/me', { fields: 'username' })
  console.log(`Autenticado como @${me.username} (credenciales desde ${CREDS_FROM})`)
} catch (err) {
  console.error(`\nLas credenciales no funcionan: ${err.message}\n`)
  console.error(`  TRELLO_KEY:   ${KEY.length} caracteres (se esperan 32 hex)`)
  console.error(`  TRELLO_TOKEN: ${TOKEN.length} caracteres, empieza con "${TOKEN.slice(0, 4)}"`)
  console.error(
    '\nEl token actual de Trello empieza con "ATTA" y mide ~76 caracteres.\n' +
      'Una cadena de 64 hex NO es un token: es el Secret de OAuth, y produce "invalid key" de forma engañosa.\n' +
      `Genera uno real en: https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=${KEY}`
  )
  process.exit(1)
}

// --- tablero: crear uno nuevo o reutilizar el existente ---------------------

let board
const existingLists = new Map() // nombre de lista -> id
const labelIds = {} // nombre de etiqueta -> id
const existingCards = new Set() // nombres de tarjetas ya presentes en el tablero

if (BOARD) {
  board = await api('GET', `/boards/${BOARD}`, { fields: 'name,shortUrl' })
  console.log(`Actualizando tablero existente: ${board.name} (${board.shortUrl})`)

  for (const l of await api('GET', `/boards/${board.id}/lists`, { fields: 'name', filter: 'all' })) {
    existingLists.set(l.name, l.id)
  }
  for (const lb of await api('GET', `/boards/${board.id}/labels`, { fields: 'name' })) {
    if (lb.name) labelIds[lb.name] = lb.id
  }
  // Se compara por nombre en todo el tablero, no por lista: una tarjeta movida a
  // "10 - Terminado" ya existe y no debe recrearse en su lista original.
  for (const c of await api('GET', `/boards/${board.id}/cards`, { fields: 'name', filter: 'all' })) {
    existingCards.add(c.name)
  }
  console.log(
    `Estado actual: ${existingLists.size} listas, ${existingCards.size} tarjetas, ${Object.keys(labelIds).length} etiquetas.`
  )
} else {
  console.log(`Creando tablero "${BOARD_NAME}" (${JSON.stringify(totals)})`)

  // El Workspace puede darse por nombre visible, nombre corto o id.
  let idOrganization = null
  if (WORKSPACE) {
    const orgs = await api('GET', '/members/me/organizations', { fields: 'name,displayName' })
    const wanted = WORKSPACE.toLowerCase()
    const org = orgs.find(
      (o) =>
        o.id === WORKSPACE ||
        o.name.toLowerCase() === wanted ||
        o.displayName.toLowerCase() === wanted
    )
    if (!org) {
      console.error(
        `No encontré el Workspace "${WORKSPACE}". Disponibles: ` +
          orgs.map((o) => `${o.displayName} (${o.name})`).join(', ')
      )
      process.exit(1)
    }
    idOrganization = org.id
    console.log(`Workspace: ${org.displayName}`)
  }

  board = await api('POST', '/boards', {
    name: BOARD_NAME,
    idOrganization,
    defaultLists: 'false',
    defaultLabels: 'false',
    prefs_permissionLevel: 'private',
    desc: 'Tablero generado desde Docs/trello-board-template.md. Trello es la fuente de verdad del estado del trabajo.',
  })
  console.log(`Tablero: ${board.shortUrl}`)
}

// etiquetas faltantes
for (const [name, color] of Object.entries(LABEL_COLORS)) {
  if (labelIds[name]) continue
  const label = await api('POST', `/boards/${board.id}/labels`, { name, color })
  labelIds[name] = label.id
}

// --- listas y tarjetas ------------------------------------------------------

const added = { lists: 0, cards: 0 }
let skipped = 0

for (const l of lists) {
  let idList = existingLists.get(l.name)
  if (!idList) {
    const created = await api('POST', '/lists', { name: l.name, idBoard: board.id, pos: 'bottom' })
    idList = created.id
    existingLists.set(l.name, idList)
    added.lists++
  }
  console.log(`\n${l.name}`)

  for (const c of l.cards) {
    if (existingCards.has(c.name)) {
      skipped++
      continue
    }

    const idLabels = c.labels.map((n) => labelIds[n]).filter(Boolean)
    const missing = c.labels.filter((n) => !labelIds[n])
    if (missing.length) console.warn(`  aviso: etiqueta desconocida ${missing.join(', ')}`)

    const trelloCard = await api('POST', '/cards', {
      name: c.name,
      desc: c.desc,
      idList,
      idLabels: idLabels.join(','),
      pos: 'bottom',
    })

    for (const g of c.checklists) {
      const checklist = await api('POST', '/checklists', { idCard: trelloCard.id, name: g.name })
      for (const item of g.items) {
        await api('POST', `/checklists/${checklist.id}/checkItems`, { name: item, pos: 'bottom' })
      }
    }
    added.cards++
    console.log(`  + ${c.name}`)
  }
}

console.log(`\nListo. ${calls} llamadas a la API.`)
console.log(`Listas nuevas: ${added.lists} | Tarjetas nuevas: ${added.cards} | Ya existían: ${skipped}`)
console.log(`Tablero: ${board.shortUrl}`)
