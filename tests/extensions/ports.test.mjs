import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadLogic } from './helper.mjs'

const { PortsLogic: P } = loadLogic('ports')

const ports = [
  { protocol: 'TCP', localAddr: '0.0.0.0', localPort: 3000, remoteAddr: '0.0.0.0', remotePort: 0, state: 'LISTEN', pid: 10, process: 'node.exe' },
  { protocol: 'TCP', localAddr: '::', localPort: 3000, remoteAddr: '::', remotePort: 0, state: 'LISTEN', pid: 10, process: 'node.exe' },
  { protocol: 'TCP', localAddr: '127.0.0.1', localPort: 51000, remoteAddr: '127.0.0.1', remotePort: 3000, state: 'ESTABLISHED', pid: 20, process: 'chrome.exe' },
  { protocol: 'UDP', localAddr: '0.0.0.0', localPort: 5353, remoteAddr: '', remotePort: 0, state: '', pid: 30, process: 'svchost.exe' },
  { protocol: 'TCP', localAddr: '0.0.0.0', localPort: 30001, remoteAddr: '0.0.0.0', remotePort: 0, state: 'LISTEN', pid: 40, process: 'java.exe' }
]

test('qui utilise le port 3000 ?', () => {
  const hits = P.filterPorts(ports, '3000', true)
  assert.equal(hits.length, 1, 'IPv4 et IPv6 fusionnés, port exact (pas 30001)')
  assert.equal(hits[0].process, 'node.exe')
  assert.equal(P.filterPorts(ports, ':3000', false).length, 1)
})

test('filtre texte et écoute seule', () => {
  assert.equal(P.filterPorts(ports, '', true).length, 3)
  assert.equal(P.filterPorts(ports, 'chrome', false).length, 1)
  assert.equal(P.filterPorts(ports, 'chrome', true).length, 0)
})

test('processus : recherche et tri', () => {
  const procs = [
    { pid: 3, name: 'b.exe', exe: 'C:\\b.exe', memory: 100, cpu: 9 },
    { pid: 1, name: 'a.exe', exe: 'C:\\a.exe', memory: 300, cpu: 1 },
    { pid: 2, name: 'code.exe', exe: 'C:\\VSCode\\code.exe', memory: 200, cpu: 5 }
  ]
  assert.deepEqual([...P.filterProcesses(procs, '', 'memory')].map(p => p.pid), [1, 2, 3])
  assert.deepEqual([...P.filterProcesses(procs, '', 'cpu')].map(p => p.pid), [3, 2, 1])
  assert.deepEqual([...P.filterProcesses(procs, 'vscode', 'name')].map(p => p.pid), [2])
  assert.equal(P.bytes(5 * 1024 * 1024), '5.0 Mo')
})
