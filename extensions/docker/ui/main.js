/* global outilo, DockerLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Docker', subtitle: 'Convertit une commande docker run en fichier compose, et inversement.',
    sample: 'Exemple', save: 'Enregistrer', copy: 'Copier', copied: 'Copié', saved: 'Fichier enregistré',
    image: 'Image introuvable : la commande doit se terminer par l’image (et éventuellement sa commande).',
    yaml: 'YAML invalide : {detail}', services: 'Aucune section « services » dans le fichier.',
    build: '# {name} : construit depuis un Dockerfile (build:), à lancer avec docker build puis docker run',
    warnings: 'Options ignorées : {list}', ok: 'Conversion réussie'
  },
  en: {
    title: 'Docker', subtitle: 'Converts a docker run command to a compose file, and back.',
    sample: 'Sample', save: 'Save', copy: 'Copy', copied: 'Copied', saved: 'File saved',
    image: 'No image found: the command must end with the image (and optionally its command).',
    yaml: 'Invalid YAML: {detail}', services: 'No “services” section in the file.',
    build: '# {name}: built from a Dockerfile (build:), run docker build then docker run',
    warnings: 'Ignored options: {list}', ok: 'Converted'
  }
}

var SAMPLES = {
  run: 'docker run -d --name web \\\n  -p 8080:80 \\\n  -v ./site:/usr/share/nginx/html:ro \\\n  -e TZ=Europe/Paris \\\n  --restart unless-stopped \\\n  nginx:1.27',
  compose: 'services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: secret\n    ports:\n      - "5432:5432"\n    volumes:\n      - pg:/var/lib/postgresql/data\n    restart: always\n'
}

var $ = function (s) { return document.querySelector(s) }
var mode = 'run'
var output = ''

function status(text, error) {
  $('#status').textContent = text
  $('#status').className = 'o-sub' + (error ? ' o-err' : ' o-ok')
}

function convert() {
  var text = $('#input').value
  output = ''
  $('#output').textContent = ''
  if (!text.trim()) return status('')
  if (mode === 'run') {
    var r = DockerLogic.runToCompose(text)
    if (!r.ok) return status(outilo.t('image'), true)
    output = r.yaml
    status(r.warnings.length ? outilo.t('warnings', { list: r.warnings.join(', ') }) : outilo.t('ok'), false)
  } else {
    var c = DockerLogic.composeToRun(text)
    if (!c.ok) return status(c.error === 'yaml' ? outilo.t('yaml', { detail: c.detail }) : outilo.t('services'), true)
    output = c.commands.map(function (x) { return x.command || outilo.t('build', { name: x.name }) }).join('\n\n')
    status(outilo.t('ok'))
  }
  $('#output').textContent = output
}

function setMode(m) {
  mode = m
  document.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === m) })
  convert()
}

document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode) }) })
$('#input').addEventListener('input', convert)
$('#sample').addEventListener('click', function () { $('#input').value = SAMPLES[mode]; convert() })
$('#copy').addEventListener('click', async function () {
  if (!output) return
  await outilo.clipboard.write(output)
  outilo.toast(outilo.t('copied'), 'success')
})
$('#save').addEventListener('click', async function () {
  if (!output) return
  if (await outilo.files.save(mode === 'run' ? 'compose.yaml' : 'docker-run.sh', output)) outilo.toast(outilo.t('saved'), 'success')
})

outilo.onLocale(convert)
outilo.ready.then(function () { $('#input').value = SAMPLES.run; setMode('run') })
