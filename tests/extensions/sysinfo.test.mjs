import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { SysLogic: S } = loadLogic('sysinfo')

test('tailles et durées', () => {
  assert.equal(S.bytes(512, 'fr'), '512 o')
  assert.equal(S.bytes(1536, 'fr'), '1.5 Ko')
  assert.equal(S.bytes(16 * 1024 ** 3, 'en'), '16 GB')
  assert.equal(S.duration(90061, 'fr'), '1 j 1 h 1 min')
  assert.equal(S.duration(125, 'en'), '2 min')
  assert.equal(S.percent(1, 3), 33)
  assert.equal(S.percent(1, 0), 0)
})

test('résumé pour un ticket', () => {
  const info = {
    os: 'Windows 11 Pro', osVersion: '24H2', hostname: 'PC-01', cpu: 'Ryzen 7', cores: 8, threads: 16, frequencyMhz: 3800,
    memoryUsed: 8 * 1024 ** 3, memoryTotal: 32 * 1024 ** 3, gpus: ['GeForce RTX 4070'], uptime: 3600, arch: 'x86_64', kernel: '26200',
    disks: [{ mount: 'C:\\', total: 1000 * 1024 ** 3, available: 400 * 1024 ** 3, fileSystem: 'NTFS', kind: 'SSD' }]
  }
  const l = { os: 'Système', host: 'Nom', cpu: 'CPU', threads: 'threads', memory: 'Mémoire', gpu: 'GPU', disk: 'Disque', uptime: 'Allumé', arch: 'Arch', kernel: 'Noyau' }
  const text = S.summary(info, 'fr', l)
  assert.match(text, /^Système : Windows 11 Pro \(24H2\)$/m)
  assert.match(text, /^Mémoire : 8\.0 Go \/ 32 Go \(25 %\)$/m)
  assert.match(text, /^Disque C:\\ : 600 Go \/ 1000 Go \(NTFS, SSD\)$/m)
  assert.match(text, /^GPU : GeForce RTX 4070$/m)
})
