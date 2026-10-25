// Texte de remplissage (testé par tests/extensions/lorem.test.mjs). Générateur déterministe si une graine est fournie.
;(function (root) {
  'use strict'

  var WORDS = {
    latin: ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore ' +
      'magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat ' +
      'duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat ' +
      'cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium tincidunt ' +
      'lacus nunc gravida vitae mauris viverra porttitor sagittis').split(' '),
    fr: ('le la les un une des et de du en avec pour sur dans par atelier outil projet idée couleur page texte maquette ' +
      'client équipe design simple clair moderne rapide léger lumière jardin matin soir ville rivière nuage chemin ' +
      'fenêtre table café livre carnet crayon papier histoire voyage saison automne printemps doux calme vif ' +
      'construire dessiner écrire imaginer tester partager ouvrir trouver garder offrir petit grand nouveau beau').split(' '),
    en: ('the a of and to in for with on by workshop tool project idea color page text mockup client team design simple ' +
      'clear modern quick light garden morning evening city river cloud path window table coffee book notebook pencil ' +
      'paper story journey season autumn spring soft calm bright build draw write imagine test share open find keep ' +
      'offer small large new beautiful').split(' ')
  }
  var CLASSIC = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit'

  function rng(seed) {
    if (seed == null || seed === '') return Math.random
    var h = 2166136261
    for (var i = 0; i < String(seed).length; i++) h = Math.imul(h ^ String(seed).charCodeAt(i), 16777619)
    var a = h >>> 0
    return function () {
      a = (a + 0x6d2b79f5) | 0
      var t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function make(o) {
    var rand = rng(o.seed)
    var list = WORDS[o.lang] || WORDS.latin
    var pick = function () { return list[Math.floor(rand() * list.length)] }
    var between = function (a, b) { return a + Math.floor(rand() * (b - a + 1)) }
    var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1) }

    function sentence() {
      var n = between(6, 14)
      var w = []
      for (var i = 0; i < n; i++) w.push(pick())
      if (n > 8) w[between(3, n - 3)] += ','
      return cap(w.join(' ')) + '.'
    }
    function paragraph() {
      var s = []
      for (var i = between(3, 6); i > 0; i--) s.push(sentence())
      return s.join(' ')
    }

    var count = Math.max(1, Math.min(o.count || 1, 500))
    var out = []
    if (o.unit === 'words') {
      for (var i = 0; i < count; i++) out.push(pick())
      out = [cap(out.join(' '))]
    } else if (o.unit === 'sentences') {
      for (var j = 0; j < count; j++) out.push(sentence())
      out = [out.join(' ')]
    } else if (o.unit === 'list') {
      for (var k = 0; k < count; k++) out.push(sentence().replace(/\.$/, ''))
    } else {
      for (var p = 0; p < count; p++) out.push(paragraph())
    }
    if (o.classic && o.lang === 'latin' && o.unit !== 'list') {
      out[0] = CLASSIC + (o.unit === 'words' ? '' : '. ') + (o.unit === 'words' ? '' : out[0])
    }
    return out
  }

  /** Mise en forme : texte brut, HTML (<p> / <ul>) ou Markdown. */
  function render(blocks, unit, format) {
    if (unit === 'list') {
      if (format === 'html') return '<ul>\n' + blocks.map(function (b) { return '  <li>' + b + '</li>' }).join('\n') + '\n</ul>'
      return blocks.map(function (b) { return (format === 'markdown' ? '- ' : '• ') + b }).join('\n')
    }
    if (format === 'html') return blocks.map(function (b) { return '<p>' + b + '</p>' }).join('\n')
    return blocks.join('\n\n')
  }

  function stats(text) {
    var words = text.trim() ? text.trim().split(/\s+/).length : 0
    return { words: words, chars: text.length }
  }

  root.LoremLogic = { make: make, render: render, stats: stats }
})(typeof window !== 'undefined' ? window : globalThis)
