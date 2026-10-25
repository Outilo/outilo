// Génération d'utilisateurs fictifs (testée par logic.test.mjs).
// Domaines e-mail réservés (RFC 2606) et numéros de téléphone réservés à la fiction (ARCEP, 555-01xx).
;(function (root) {
  'use strict'

  var DATA = {
    fr: {
      first: ['Camille', 'Lucas', 'Léa', 'Hugo', 'Chloé', 'Nathan', 'Manon', 'Louis', 'Inès', 'Jules', 'Emma', 'Arthur',
        'Sarah', 'Théo', 'Jade', 'Gabriel', 'Louise', 'Raphaël', 'Alice', 'Adam', 'Lina', 'Paul', 'Rose', 'Noah', 'Anna',
        'Maël', 'Zoé', 'Sacha', 'Julia', 'Tom', 'Mila', 'Ethan', 'Lou', 'Victor', 'Ambre', 'Nolan', 'Agathe', 'Martin'],
      last: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon',
        'Laurent', 'Lefèvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard',
        'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Legrand', 'Garnier', 'Faure', 'Rousseau'],
      cities: [['Paris', '75011'], ['Lyon', '69003'], ['Marseille', '13006'], ['Toulouse', '31000'], ['Nantes', '44000'],
        ['Bordeaux', '33000'], ['Lille', '59000'], ['Rennes', '35000'], ['Strasbourg', '67000'], ['Montpellier', '34000'],
        ['Nice', '06000'], ['Grenoble', '38000'], ['Dijon', '21000'], ['Angers', '49000'], ['Tours', '37000']],
      streets: ['rue de la République', 'avenue Jean Jaurès', 'rue Victor Hugo', 'boulevard Pasteur', 'rue des Lilas',
        'place de la Mairie', 'rue du Moulin', 'allée des Tilleuls', 'rue de la Gare', 'chemin des Vignes', 'rue Voltaire'],
      jobs: ['Développeuse back-end', 'Développeur front-end', 'Product owner', 'Ingénieure DevOps', 'Designer UI/UX',
        'Data analyst', 'Chef de projet', 'Responsable marketing', 'Comptable', 'Technicien support', 'Architecte cloud',
        'Rédactrice web', 'Commercial', 'Juriste', 'Infirmière', 'Professeur'],
      companies: ['Atelier Numérique', 'Groupe Horizon', 'Studio Lumière', 'Boulangerie Martin & Fils', 'Nova Conseil',
        'Cabinet Moreau', 'Transports Rapides', 'Agence Pixel', 'Ferme du Val', 'Solutions Delta'],
      country: 'France',
      domains: ['example.com', 'example.org', 'example.net'],
      phone: function (r) { return '06 39 98 ' + pad(r(100)) + ' ' + pad(r(100)) },
      address: function (n, s) { return n + ' ' + s }
    },
    en: {
      first: ['Olivia', 'Liam', 'Emma', 'Noah', 'Ava', 'Oliver', 'Sophia', 'Elijah', 'Isabella', 'James', 'Mia', 'William',
        'Amelia', 'Benjamin', 'Harper', 'Lucas', 'Evelyn', 'Henry', 'Abigail', 'Alexander', 'Emily', 'Jack', 'Ella', 'Daniel',
        'Grace', 'Michael', 'Chloe', 'Owen', 'Lily', 'Samuel', 'Zoey', 'Ethan', 'Nora', 'Leo', 'Hazel', 'Mason'],
      last: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
        'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
        'Clark', 'Lewis', 'Walker', 'Hall', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson'],
      cities: [['New York, NY', '10001'], ['Austin, TX', '73301'], ['Seattle, WA', '98101'], ['Denver, CO', '80202'],
        ['Boston, MA', '02108'], ['Chicago, IL', '60601'], ['Portland, OR', '97201'], ['Miami, FL', '33101'],
        ['San Diego, CA', '92101'], ['Atlanta, GA', '30301'], ['Phoenix, AZ', '85001'], ['Nashville, TN', '37201']],
      streets: ['Main Street', 'Oak Avenue', 'Maple Drive', 'Cedar Lane', 'Park Road', 'Elm Street', 'Washington Avenue',
        'Lake View Drive', 'Sunset Boulevard', 'Highland Avenue', 'River Road'],
      jobs: ['Backend developer', 'Frontend developer', 'Product manager', 'DevOps engineer', 'UX designer', 'Data analyst',
        'Project manager', 'Marketing lead', 'Accountant', 'Support technician', 'Cloud architect', 'Content writer',
        'Sales representative', 'Lawyer', 'Nurse', 'Teacher'],
      companies: ['Northwind Labs', 'Blue Harbor Inc.', 'Acme Studio', 'Summit Partners', 'Brightside Media',
        'Evergreen Logistics', 'Pioneer Analytics', 'Redwood Bakery', 'Atlas Consulting', 'Silverline Health'],
      country: 'United States',
      domains: ['example.com', 'example.org', 'example.net'],
      phone: function (r) { return '(' + (200 + r(800)) + ') 555-01' + pad(r(100)) },
      address: function (n, s) { return n + ' ' + s }
    }
  }

  var FIELDS = ['id', 'firstName', 'lastName', 'email', 'username', 'phone', 'birthdate', 'street', 'zip', 'city',
    'country', 'company', 'jobTitle']

  function pad(n) { return (n < 10 ? '0' : '') + n }

  /** Générateur pseudo-aléatoire déterministe (mulberry32) pour les graines. */
  function rng(seed) {
    var a = seed >>> 0
    return function (max) {
      a = (a + 0x6d2b79f5) >>> 0
      var t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      var f = ((t ^ (t >>> 14)) >>> 0) / 4294967296
      return Math.floor(f * max)
    }
  }

  function hashSeed(text) {
    var h = 2166136261
    for (var i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
    return h >>> 0
  }

  function randomSeed() {
    var b = new Uint32Array(1)
    crypto.getRandomValues(b)
    return b[0]
  }

  function slugName(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  }

  function uuid(r) {
    var hex = ''
    for (var i = 0; i < 32; i++) hex += r(16).toString(16)
    hex = hex.slice(0, 12) + '4' + hex.slice(13, 16) + ((8 + r(4)).toString(16)) + hex.slice(17)
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20)
  }

  function pick(r, arr) { return arr[r(arr.length)] }

  function user(r, lang, now) {
    var d = DATA[lang] || DATA.fr
    var first = pick(r, d.first)
    var last = pick(r, d.last)
    var place = pick(r, d.cities)
    var year = now.getFullYear() - 18 - r(50)
    var birth = year + '-' + pad(1 + r(12)) + '-' + pad(1 + r(28))
    var handle = slugName(first) + '.' + slugName(last)
    return {
      id: uuid(r),
      firstName: first,
      lastName: last,
      email: handle + (r(3) === 0 ? r(100) : '') + '@' + pick(r, d.domains),
      username: slugName(first).slice(0, 1) + slugName(last) + r(1000),
      phone: d.phone(r),
      birthdate: birth,
      street: d.address(1 + r(180), pick(r, d.streets)),
      zip: place[1],
      city: place[0],
      country: d.country,
      company: pick(r, d.companies),
      jobTitle: pick(r, d.jobs)
    }
  }

  /** opts : { count, lang, seed (texte, optionnel), now (Date, pour les tests) } */
  function generate(opts) {
    var seed = opts.seed ? hashSeed(String(opts.seed)) : randomSeed()
    var r = rng(seed)
    var count = Math.max(1, Math.min(10000, opts.count | 0))
    var now = opts.now || new Date()
    var out = []
    for (var i = 0; i < count; i++) out.push(user(r, opts.lang, now))
    return out
  }

  function pickFields(users, fields) {
    return users.map(function (u) {
      var o = {}
      fields.forEach(function (f) { o[f] = u[f] })
      return o
    })
  }

  function toJSON(users, fields) { return JSON.stringify(pickFields(users, fields), null, 2) }

  function csvCell(v) {
    var s = v == null ? '' : String(v)
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }

  function toCSV(users, fields) {
    var lines = [fields.join(',')]
    users.forEach(function (u) { lines.push(fields.map(function (f) { return csvCell(u[f]) }).join(',')) })
    return lines.join('\r\n') + '\r\n'
  }

  function snake(f) { return f.replace(/[A-Z]/g, function (c) { return '_' + c.toLowerCase() }) }

  function toSQL(users, fields, table) {
    table = /^[A-Za-z_][A-Za-z0-9_]*$/.test(table || '') ? table : 'users'
    var cols = fields.map(snake).join(', ')
    var rows = users.map(function (u) {
      return '  (' + fields.map(function (f) { return "'" + String(u[f]).replace(/'/g, "''") + "'" }).join(', ') + ')'
    })
    return 'INSERT INTO ' + table + ' (' + cols + ') VALUES\n' + rows.join(',\n') + ';\n'
  }

  root.FakeUserLogic = { generate: generate, toJSON: toJSON, toCSV: toCSV, toSQL: toSQL, FIELDS: FIELDS, DATA: DATA }
})(typeof window !== 'undefined' ? window : globalThis)
