import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { DockerLogic: D } = loadLogic('docker', ['vendor/js-yaml.min.js'])
const plain = v => JSON.parse(JSON.stringify(v))

test('découpage façon shell', () => {
  assert.deepEqual([...D.tokenize(`docker run -e "A=b c" -e 'X=y' \\\n  nginx`)], ['docker', 'run', '-e', 'A=b c', '-e', 'X=y', 'nginx'])
  assert.deepEqual([...D.tokenize('echo "a \\"b\\"" c\\ d')], ['echo', 'a "b"', 'c d'])
})

test('docker run → compose', () => {
  const r = D.runToCompose('docker run -d --rm --name web -p 8080:80 -p 443:443 -v ./data:/data -e TZ=Europe/Paris --restart=unless-stopped --network proxy nginx:1.27 nginx -g "daemon off;"')
  assert.ok(r.ok)
  const s = plain(r.doc).services.web
  assert.equal(s.image, 'nginx:1.27')
  assert.deepEqual(s.ports, ['8080:80', '443:443'])
  assert.deepEqual(s.environment, ['TZ=Europe/Paris'])
  assert.equal(s.restart, 'unless-stopped')
  assert.deepEqual(s.command, ['nginx', '-g', 'daemon off;'])
  assert.deepEqual(plain(r.doc).networks, { proxy: { external: true } })
  assert.deepEqual([...r.warnings], ['--rm'])
  assert.match(r.yaml, /^services:\n {2}web:\n {4}image: nginx:1\.27/)
  const host = plain(D.runToCompose('docker run --network host -it redis').doc).services.redis
  assert.equal(host.network_mode, 'host')
  assert.equal(host.tty, true)
  assert.equal(D.runToCompose('docker run -d').ok, false)
})

test('compose → docker run', () => {
  const r = D.composeToRun('services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: "mot de passe"\n    ports: ["5432:5432"]\n    volumes: [pg:/var/lib/postgresql/data]\n  app:\n    build: .\n')
  assert.ok(r.ok)
  const db = r.commands.find(c => c.name === 'db').command.replace(/ \\\n {2}/g, ' ')
  assert.equal(db, "docker run -d --name db -p 5432:5432 -v pg:/var/lib/postgresql/data -e 'POSTGRES_PASSWORD=mot de passe' postgres:16")
  assert.equal(r.commands.find(c => c.name === 'app').error, 'build')
  assert.equal(D.composeToRun('a: [').ok, false)
})
