// Logique pure du générateur (testée par logic.test.mjs). Aléa cryptographique uniquement.
;(function (root) {
  'use strict'

  var SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~'
  }
  var SIMILAR = /[0O1lI|]/g
  var AMBIGUOUS = /[{}[\]()/\\'"`~,;:.<>]/g

  var WORDS = {
    fr: ('abeille abricot acier agneau album algue amande ambre ancre anneau arbre argile arome astre atelier aube avion ' +
      'badge baie balcon bambou banane barque bassin bateau berger biscuit bison bleuet boussole brique brume bulle cactus ' +
      'cadran caillou calme canal canard carafe castor cedre cerise chalet chameau chanson chardon chemin cigale citron ' +
      'clairon cobalt colline comete corail coton crayon cristal cuivre dauphin desert diamant domino dragon dune ecorce ' +
      'eclair ecureuil emeraude encre epice etoile falaise faucon fenetre fleuve flocon foret fougere framboise fusee ' +
      'galet gazelle geyser girafe glacier gland granit grenade guitare hamac hibou horizon ile indigo iris jade jardin ' +
      'jasmin jungle kiwi lagon lampe lavande lezard licorne lilas lynx magma mangue marbre marmotte melodie meteore ' +
      'miroir moulin mousse nacre nectar neige nuage oasis ocean olive orage orchidee origami ours palmier panda papillon ' +
      'parfum perle phare piano pigeon pivoine planete plume pollen prairie quartz radeau raisin renard requin rivage ' +
      'riviere rocher rubis sable safran saphir sapin saule savane sirop soleil source sphinx tambour tempete tigre ' +
      'tonnerre topaze tortue toucan tournesol trefle tulipe valise vallee vanille velours vent verger violon volcan zebre').split(' '),
    en: ('acorn amber anchor apple arrow atlas autumn badger bamboo banjo beacon berry bison blossom breeze brick ' +
      'bubble cactus camel canyon cedar cherry cliff clover cobalt comet copper coral cotton crane crystal dawn delta ' +
      'desert diamond dolphin dragon dune eagle ember emerald falcon feather fern fjord flame forest fossil fox galaxy ' +
      'garden geyser ginger glacier granite grape harbor hazel heron honey horizon island ivory jade jasmine jungle ' +
      'kayak kettle koala lagoon lantern lava lemon lily lotus lynx magnet mango maple marble meadow meteor mint mirror ' +
      'moss nectar nebula oasis ocean olive onyx orbit orchid otter owl palm panda parrot pebble pepper piano pine planet ' +
      'plum pollen prairie quartz quill raven reef ripple river robin ruby saffron sage sapphire savanna shell silver ' +
      'sparrow spruce storm summit sunset swan tiger timber topaz tulip tundra valley velvet violet volcano walnut ' +
      'willow winter zebra zephyr').split(' ')
  }

  /** Entier uniforme dans [0, max) sans biais de modulo. */
  function randomInt(max) {
    var limit = Math.floor(0x100000000 / max) * max
    var buf = new Uint32Array(1)
    do crypto.getRandomValues(buf)
    while (buf[0] >= limit)
    return buf[0] % max
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randomInt(i + 1)
      var tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }

  function pools(opts) {
    return ['upper', 'lower', 'digits', 'symbols']
      .filter(function (k) { return opts[k] })
      .map(function (k) {
        var s = SETS[k]
        if (opts.excludeSimilar) s = s.replace(SIMILAR, '')
        if (opts.excludeAmbiguous) s = s.replace(AMBIGUOUS, '')
        return s
      })
      .filter(function (s) { return s.length > 0 })
  }

  /** Mot de passe contenant au moins un caractère de chaque jeu choisi. */
  function password(opts) {
    var sets = pools(opts)
    if (!sets.length) sets = [SETS.lower]
    var length = Math.max(4, Math.min(128, opts.length | 0))
    var all = sets.join('')
    var chars = sets.slice(0, length).map(function (s) { return s[randomInt(s.length)] })
    while (chars.length < length) chars.push(all[randomInt(all.length)])
    return { value: shuffle(chars).join(''), bits: Math.round(length * Math.log2(new Set(all).size)) }
  }

  function passphrase(opts) {
    var list = WORDS[opts.lang] || WORDS.fr
    var count = Math.max(3, Math.min(12, opts.words | 0))
    var words = []
    for (var i = 0; i < count; i++) {
      var w = list[randomInt(list.length)]
      words.push(opts.capitalize ? w[0].toUpperCase() + w.slice(1) : w)
    }
    var bits = count * Math.log2(list.length)
    if (opts.number) {
      words.push(String(randomInt(100)))
      bits += Math.log2(100)
    }
    return { value: words.join(opts.separator == null ? '-' : opts.separator), bits: Math.round(bits) }
  }

  /** 0 = faible, 1 = correct, 2 = fort, 3 = très fort */
  function strength(bits) {
    return bits < 50 ? 0 : bits < 80 ? 1 : bits < 110 ? 2 : 3
  }

  root.PasswordLogic = { password: password, passphrase: passphrase, strength: strength, randomInt: randomInt, WORDS: WORDS }
})(typeof window !== 'undefined' ? window : globalThis)
