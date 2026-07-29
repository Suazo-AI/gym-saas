import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

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

  expect(result.status, result.stderr).toBe(0)
  expect(result.stdout).toMatch(/Dry run: no se llamó a la API de Trello\./)
  expect(`${result.stdout}${result.stderr}`).not.toMatch(new RegExp(`${key}|${token}`))
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

  expect(result.status).toBe(1)
  expect(result.stderr).toMatch(/Faltan TRELLO_KEY y TRELLO_TOKEN/)
})

test('the client has no update or delete API operations', () => {
  const source = readFileSync(script, 'utf8')

  expect(source).not.toMatch(/api\(['"](?:PUT|DELETE)['"]/)
})
