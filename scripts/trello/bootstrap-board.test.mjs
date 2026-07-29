import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const script = fileURLToPath(new URL('./bootstrap-board.mjs', import.meta.url))
const projectRoot = fileURLToPath(new URL('../../', import.meta.url))

function run(args, env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

test('dry-run does not require or expose Trello credentials', () => {
  const key = 'TEST_KEY_MUST_NOT_APPEAR'
  const token = 'TEST_TOKEN_MUST_NOT_APPEAR'
  const result = run(['--dry-run'], {
    TRELLO_KEY: key,
    TRELLO_TOKEN: token,
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Dry run: no se llamó a la API de Trello\./)
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(`${key}|${token}`))
})

test('write mode stops before the API when credentials are missing', () => {
  const env = { ...process.env }
  delete env.TRELLO_KEY
  delete env.TRELLO_TOKEN
  env.USERPROFILE = 'Z:\\trello-credentials-do-not-exist'
  env.HOME = env.USERPROFILE

  const result = spawnSync(process.execPath, [script, '--board', 'test-board'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env,
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /Faltan TRELLO_KEY y TRELLO_TOKEN/)
})

test('the client has no update or delete API operations', () => {
  const source = readFileSync(script, 'utf8')

  assert.doesNotMatch(source, /api\(['"](?:PUT|DELETE)['"]/)
})
