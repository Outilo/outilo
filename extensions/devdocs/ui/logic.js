// Doc développeur (testée par tests/extensions/devdocs.test.mjs) : vérification d'un manifeste et données de référence.
// Règles identiques à scripts/lib/validate.mjs (sans les vérifications de fichiers).
;(function (root) {
  'use strict'

  var KNOWN = { clipboard: false, storage: false, 'storage.sql': false, 'files.save': false, 'files.pick': false, 'system.info': false, network: false, 'files.scoped': true, process: true, 'shell.safe': true }
  var SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/

  function flatten(table, prefix, out) {
    Object.keys(table || {}).forEach(function (k) {
      var v = table[k]
      var name = prefix ? prefix + '.' + k : k
      if (v && typeof v === 'object' && !Array.isArray(v) && !(name in KNOWN)) flatten(v, name, out)
      else if (v !== false) out.push(name)
    })
    return out
  }

  function isValidId(id) {
    var parts = String(id).split('.')
    return parts.length >= 2 && String(id).length <= 64 && parts.every(function (p) { return p && p[0] !== '-' && /^[a-z0-9-]+$/.test(p) })
  }

  function safeRelative(p) { return typeof p === 'string' && p && !/^([a-zA-Z]:|[\\/])/.test(p) && p.split(/[\\/]/).indexOf('..') < 0 }

  /** Vérifie le texte d'un outilo.toml ; `community` applique les règles du store pour les extensions tierces. */
  function validate(text, community) {
    var errors = []
    var warnings = []
    var m
    try { m = root.smolToml.parse(String(text)) } catch (e) { return { ok: false, errors: ['TOML : ' + e.message.split('\n')[0]], warnings: warnings } }
    var ext = m.extension || {}
    if (!isValidId(ext.id)) errors.push('id')
    if (community && String(ext.id).indexOf('outilo.') === 0) errors.push('reserved')
    if (!ext.name) errors.push('name')
    else if (typeof ext.name === 'string') warnings.push('nameLocalized')
    if (!SEMVER.test(String(ext.version))) errors.push('version')
    if (String(ext.api) !== '1') errors.push('api')
    if (!ext.description) warnings.push('description')
    if (!ext.license) warnings.push('license')
    if (!m.ui) errors.push('ui')
    else if (!safeRelative(m.ui.entry)) errors.push('entry')
    var perms = flatten(m.permissions, '', [])
    perms.forEach(function (p) {
      if (!(p in KNOWN)) errors.push('unknown:' + p)
      else if (community && KNOWN[p]) errors.push('sensitive:' + p)
    })
    var net = m.permissions && m.permissions.network
    if (net !== undefined && net !== false) {
      if (!Array.isArray(net) || !net.length) errors.push('network')
      else if (community && net.indexOf('*') >= 0) errors.push('networkAll')
    }
    return { ok: !errors.length, errors: errors, warnings: warnings, permissions: perms, id: ext.id }
  }

  var SDK = [
    ['outilo.ready', '', 'ready'], ['outilo.messages / outilo.t(clé, params)', '', 'i18n'], ['outilo.locale, outilo.mode', '', 'locale'],
    ['outilo.clipboard.write(texte)', 'clipboard', 'clipboard'], ['outilo.storage.get / set / remove / keys', 'storage', 'storage'],
    ['outilo.sql.query(sql, params) / exec(script)', 'storage.sql', 'sql'], ['outilo.files.save(nom, contenu, { encoding })', 'files.save', 'save'],
    ['outilo.system.info()', 'system.info', 'system'], ['outilo.net.fetch(url, options)', 'network', 'fetch'],
    ['outilo.net.lookup / tcp / ping / interfaces', 'network', 'netdiag'], ['outilo.process.list / ports / kill(pid)', 'process', 'process'],
    ['outilo.clean.scan() / run(ids)', 'files.scoped', 'clean'], ['outilo.shell.flushDns()', 'shell.safe', 'dns'],
    ['outilo.toast(message, type)', '', 'toast'], ['outilo.onCommand / onLocale / onTheme', '', 'events']
  ]

  var MCP_COMMAND = 'npx -y -p github:Outilo/outilo outilo-mcp'

  function mcpConfig(client) {
    if (client === 'claude-code') return 'claude mcp add outilo -- ' + MCP_COMMAND
    var server = { command: 'npx', args: ['-y', '-p', 'github:Outilo/outilo', 'outilo-mcp'] }
    if (client === 'vscode') return JSON.stringify({ servers: { outilo: Object.assign({ type: 'stdio' }, server) } }, null, 2)
    return JSON.stringify({ mcpServers: { outilo: server } }, null, 2)
  }

  root.DevLogic = { validate: validate, flatten: flatten, isValidId: isValidId, KNOWN: KNOWN, SDK: SDK, mcpConfig: mcpConfig }
})(typeof window !== 'undefined' ? window : globalThis)
