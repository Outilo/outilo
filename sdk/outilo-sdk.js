/*!
 * Outilo SDK — API disponible dans chaque extension (window.outilo).
 * Licence Apache-2.0.
 *
 * L'extension tourne dans une iframe isolée : elle n'accède au système qu'en
 * envoyant des messages au shell, qui vérifie les permissions du manifeste.
 */
;(function () {
  'use strict'

  var pending = new Map()
  var seq = 0
  var listeners = { command: [], locale: [], theme: [] }
  var state = { locale: 'fr', mode: 'dark', id: null }
  var messages = {}
  var resolveReady
  var ready = new Promise(function (r) { resolveReady = r })

  function post(msg) {
    msg.__outilo = 1
    window.parent.postMessage(msg, '*')
  }

  function call(method, params) {
    return new Promise(function (resolve, reject) {
      var id = ++seq
      pending.set(id, { resolve: resolve, reject: reject })
      post({ kind: 'call', id: id, method: method, params: params || {} })
    })
  }

  function applyTheme(vars, mode) {
    var root = document.documentElement
    Object.keys(vars || {}).forEach(function (k) { root.style.setProperty(k, vars[k]) })
    if (mode) {
      state.mode = mode
      root.dataset.mode = mode
      root.style.colorScheme = mode
    }
  }

  function applyLocale(locale) {
    state.locale = locale
    document.documentElement.lang = locale
    translateDom()
  }

  /** Remplace le contenu des éléments [data-i18n="clé"] à partir de outilo.messages. */
  function translateDom() {
    var dict = (api.messages && api.messages[state.locale]) || {}
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n')]
      if (v != null) el.textContent = v
    })
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n-placeholder')]
      if (v != null) el.setAttribute('placeholder', v)
    })
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n-title')]
      if (v != null) el.setAttribute('title', v)
    })
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return
    var m = event.data
    if (!m || m.__outilo !== 1) return
    switch (m.kind) {
      case 'reply': {
        var p = pending.get(m.id)
        if (!p) return
        pending.delete(m.id)
        m.error ? p.reject(new Error(m.error)) : p.resolve(m.result)
        break
      }
      case 'init':
        state.id = m.id
        applyTheme(m.vars, m.mode)
        applyLocale(m.locale)
        resolveReady()
        break
      case 'theme':
        applyTheme(m.vars, m.mode)
        listeners.theme.forEach(function (cb) { cb(state.mode) })
        break
      case 'locale':
        applyLocale(m.locale)
        listeners.locale.forEach(function (cb) { cb(m.locale) })
        break
      case 'command':
        ready.then(function () { listeners.command.forEach(function (cb) { cb(m.command) }) })
        break
    }
  })

  // Raccourcis globaux transmis au shell (la palette doit rester accessible depuis un outil)
  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase()
    if ((e.ctrlKey || e.metaKey) && (k === 'k' || k === 'p' || k === 'w' || k === 'tab' || k === ',')) {
      e.preventDefault()
      post({ kind: 'key', key: k, shift: e.shiftKey })
    }
  })

  var api = {
    /** Résolue quand le thème et la langue sont appliqués. */
    ready: ready,
    /** Traductions de l'extension : { fr: {…}, en: {…} } — utilisées par t() et data-i18n. */
    get messages() { return messages },
    // La langue peut arriver avant le script de l'extension : on retraduit dès que les textes sont fournis
    set messages(value) {
      messages = value || {}
      if (state.id) translateDom()
    },

    get locale() { return state.locale },
    get mode() { return state.mode },

    /** Traduit une clé de outilo.messages (avec {param}). */
    t: function (key, params) {
      var dict = api.messages[state.locale] || api.messages.fr || {}
      var s = dict[key] != null ? String(dict[key]) : key
      Object.keys(params || {}).forEach(function (p) { s = s.split('{' + p + '}').join(String(params[p])) })
      return s
    },
    translate: translateDom,

    clipboard: {
      /** Permission : clipboard */
      write: function (text) { return call('clipboard.write', { text: String(text) }) }
    },
    storage: {
      /** Permission : storage */
      get: function (key) { return call('storage.get', { key: key }) },
      set: function (key, value) { return call('storage.set', { key: key, value: value }) },
      remove: function (key) { return call('storage.remove', { key: key }) },
      keys: function () { return call('storage.keys') }
    },
    files: {
      /**
       * Permission : files.save — ouvre la boîte « Enregistrer sous ». Résout true si enregistré.
       * Fichier binaire : passer le contenu en base64 avec { encoding: 'base64' }.
       */
      save: function (name, content, options) {
        return call('files.save', { name: name, content: String(content), encoding: options && options.encoding })
      }
    },
    sql: {
      /** Permission : storage.sql — une instruction avec paramètres « ? ». Résout { columns, rows, changes, truncated }. */
      query: function (sql, params) { return call('sql.query', { sql: String(sql), params: params || [] }) },
      /** Permission : storage.sql — script de plusieurs instructions (création de tables…). */
      exec: function (script) { return call('sql.exec', { sql: String(script) }) }
    },
    system: {
      /** Permission : system.info — OS, processeur, mémoire, disques, cartes graphiques, interfaces réseau. */
      info: function () { return call('system.info') }
    },
    process: {
      /** Permission : process — processus de la session (triés par mémoire). */
      list: function () { return call('process.list') },
      /** Permission : process — sockets TCP/UDP avec le processus propriétaire. */
      ports: function () { return call('process.ports') },
      /** Permission : process — arrête un processus après confirmation de l'utilisateur. Résout true si arrêté. */
      kill: function (pid) { return call('process.kill', { pid: pid }) }
    },
    net: {
      /** Permission : network — requête HTTP vers un domaine déclaré. Résout { status, headers, body, ms }. */
      fetch: function (url, options) {
        options = options || {}
        return call('net.fetch', { url: String(url), method: options.method, headers: options.headers, body: options.body })
      },
      lookup: function (host) { return call('net.lookup', { host: host }) },
      tcp: function (host, port, timeout) { return call('net.tcp', { host: host, port: port, timeout: timeout }) },
      ping: function (host, count) { return call('net.ping', { host: host, count: count }) },
      interfaces: function () { return call('net.interfaces') }
    },
    shell: {
      /** Permission : shell.safe — vide le cache DNS de Windows. */
      flushDns: function () { return call('shell.flushDns') }
    },
    clean: {
      /** Permission : files.scoped — taille des caches connus du profil utilisateur. */
      scan: function () { return call('clean.scan') },
      /** Permission : files.scoped — vide les cibles choisies après confirmation. Résout null si annulé. */
      run: function (targets) { return call('clean.run', { targets: targets }) }
    },
    /** Affiche une notification dans le shell. */
    toast: function (message, type) { return call('toast', { message: String(message), type: type || 'info' }) },

    onCommand: function (cb) { listeners.command.push(cb) },
    onLocale: function (cb) { listeners.locale.push(cb) },
    onTheme: function (cb) { listeners.theme.push(cb) }
  }

  window.outilo = api
  post({ kind: 'hello' })
})()
