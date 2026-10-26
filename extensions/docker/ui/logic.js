// docker run ⇄ docker compose (testé par tests/extensions/docker.test.mjs). YAML : js-yaml (MIT), dans vendor/.
;(function (root) {
  'use strict'

  /** Découpe une commande comme un shell (guillemets, échappements, lignes continuées par \ ou `). */
  function tokenize(cmd) {
    var s = String(cmd).replace(/[\\`]\r?\n/g, ' ')
    var out = []
    var cur = ''
    var quote = null
    var has = false
    for (var i = 0; i < s.length; i++) {
      var c = s[i]
      if (quote) {
        if (c === quote) quote = null
        else if (c === '\\' && quote === '"' && i + 1 < s.length) cur += s[++i]
        else cur += c
      } else if (c === '"' || c === "'") { quote = c; has = true }
      else if (c === '\\' && i + 1 < s.length) { cur += s[++i]; has = true }
      else if (/\s/.test(c)) { if (cur || has) out.push(cur); cur = ''; has = false }
      else { cur += c; has = true }
    }
    if (cur || has) out.push(cur)
    return out
  }

  // Options avec valeur : drapeau → [clé compose, liste ?]
  var VALUED = {
    '--name': ['container_name'], '-p': ['ports', 1], '--publish': ['ports', 1], '-v': ['volumes', 1], '--volume': ['volumes', 1],
    '-e': ['environment', 1], '--env': ['environment', 1], '--env-file': ['env_file', 1], '--restart': ['restart'],
    '--network': ['networks', 1], '--net': ['networks', 1], '-w': ['working_dir'], '--workdir': ['working_dir'],
    '--entrypoint': ['entrypoint'], '-u': ['user'], '--user': ['user'], '-h': ['hostname'], '--hostname': ['hostname'],
    '-l': ['labels', 1], '--label': ['labels', 1], '--add-host': ['extra_hosts', 1], '--cap-add': ['cap_add', 1],
    '--cap-drop': ['cap_drop', 1], '--memory': ['mem_limit'], '-m': ['mem_limit'], '--cpus': ['cpus'],
    '--dns': ['dns', 1], '--device': ['devices', 1], '--platform': ['platform'], '--pull': ['pull_policy'],
    '--health-cmd': ['healthcheck.test'], '--expose': ['expose', 1], '--tmpfs': ['tmpfs', 1], '--shm-size': ['shm_size']
  }
  var FLAGS = { '--privileged': 'privileged', '--init': 'init', '--read-only': 'read_only', '-t': 'tty', '--tty': 'tty', '-i': 'stdin_open', '--interactive': 'stdin_open' }
  var IGNORED = ['-d', '--detach', '--rm']

  function runToCompose(cmd) {
    var t = tokenize(cmd)
    var warnings = []
    var i = 0
    while (i < t.length && /^(sudo|docker|run|container)$/.test(t[i])) i++
    var svc = {}
    for (; i < t.length; i++) {
      var tok = t[i]
      if (tok[0] !== '-') break
      var eq = tok.indexOf('=')
      var flag = tok.startsWith('--') && eq > 0 ? tok.slice(0, eq) : tok
      var inline = tok.startsWith('--') && eq > 0 ? tok.slice(eq + 1) : null
      if (IGNORED.indexOf(flag) >= 0) { if (flag === '--rm') warnings.push('--rm'); continue }
      if (FLAGS[flag]) { svc[FLAGS[flag]] = true; continue }
      if (/^-[a-z]{2,}$/.test(flag)) { // -dit : drapeaux courts groupés
        flag.slice(1).split('').forEach(function (f) { if (FLAGS['-' + f]) svc[FLAGS['-' + f]] = true })
        continue
      }
      var spec = VALUED[flag]
      var value = inline != null ? inline : t[++i]
      if (!spec) { warnings.push(flag); continue }
      if (spec[0] === 'healthcheck.test') { svc.healthcheck = { test: ['CMD-SHELL', value] }; continue }
      if (spec[1]) (svc[spec[0]] = svc[spec[0]] || []).push(value)
      else svc[spec[0]] = value
    }
    if (i >= t.length) return { ok: false, error: 'image' }
    svc = Object.assign({ image: t[i] }, svc)
    var rest = t.slice(i + 1)
    if (rest.length) svc.command = rest
    if (svc.entrypoint) svc.entrypoint = tokenize(svc.entrypoint)
    var name = svc.container_name || String(svc.image).split('/').pop().split(':')[0].replace(/[^\w.-]/g, '') || 'app'
    var doc = { services: {} }
    doc.services[name] = svc
    if (svc.networks) {
      doc.networks = {}
      svc.networks.forEach(function (n) { if (!/^(host|bridge|none)$/.test(n)) doc.networks[n] = { external: true } })
      if (svc.networks.length === 1 && /^(host|bridge|none)$/.test(svc.networks[0])) { svc.network_mode = svc.networks[0]; delete svc.networks }
      if (!Object.keys(doc.networks).length) delete doc.networks
    }
    return { ok: true, doc: doc, yaml: root.jsyaml.dump(doc, { lineWidth: 120, noRefs: true }), warnings: warnings }
  }

  function q(v) {
    var s = String(v)
    return /^[\w@%+=:,./-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'"
  }

  function composeToRun(text) {
    var doc
    try { doc = root.jsyaml.load(text) } catch (e) { return { ok: false, error: 'yaml', detail: e.reason || e.message } }
    if (!doc || typeof doc.services !== 'object') return { ok: false, error: 'services' }
    var commands = Object.keys(doc.services).map(function (name) {
      var s = doc.services[name] || {}
      var a = ['docker run -d']
      a.push('--name ' + q(s.container_name || name))
      var list = function (flag, v) { [].concat(v || []).forEach(function (x) { a.push(flag + ' ' + q(typeof x === 'object' ? (x.published + ':' + x.target) : x)) }) }
      list('-p', s.ports)
      list('-v', s.volumes)
      var env = s.environment
      if (env && !Array.isArray(env)) env = Object.keys(env).map(function (k) { return k + '=' + (env[k] == null ? '' : env[k]) })
      list('-e', env)
      list('--env-file', s.env_file)
      if (s.restart) a.push('--restart ' + q(s.restart))
      if (s.network_mode) a.push('--network ' + q(s.network_mode))
      list('--network', Array.isArray(s.networks) ? s.networks : s.networks ? Object.keys(s.networks) : [])
      if (s.working_dir) a.push('-w ' + q(s.working_dir))
      if (s.user) a.push('-u ' + q(s.user))
      if (s.hostname) a.push('-h ' + q(s.hostname))
      if (s.entrypoint) a.push('--entrypoint ' + q([].concat(s.entrypoint).join(' ')))
      if (s.privileged) a.push('--privileged')
      if (s.mem_limit) a.push('--memory ' + q(s.mem_limit))
      if (s.cpus) a.push('--cpus ' + q(s.cpus))
      list('--add-host', s.extra_hosts)
      var labels = s.labels && !Array.isArray(s.labels) ? Object.keys(s.labels).map(function (k) { return k + '=' + s.labels[k] }) : s.labels
      list('-l', labels)
      if (!s.image) return { name: name, command: null, error: 'build' }
      a.push(q(s.image))
      if (s.command) a.push([].concat(s.command).map(q).join(' '))
      return { name: name, command: a.join(' \\\n  ') }
    })
    return { ok: true, commands: commands }
  }

  root.DockerLogic = { tokenize: tokenize, runToCompose: runToCompose, composeToRun: composeToRun }
})(typeof window !== 'undefined' ? window : globalThis)
