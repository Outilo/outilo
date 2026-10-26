/* global outilo, TimerLogic */
'use strict'

outilo.messages = {
  fr: {
    title: 'Minuteur', subtitle: 'Compte à rebours, chronomètre et pomodoro. Continue de tourner quand vous changez d’onglet.',
    countdown: 'Compte à rebours', stopwatch: 'Chronomètre', durationHint: '5:00, 1h30, 90s…', work: 'Travail', short: 'Pause',
    long: 'Longue pause', start: 'Démarrer', pause: 'Pause', resume: 'Reprendre', lap: 'Tour', reset: 'Réinitialiser', sound: 'Son',
    done: 'Temps écoulé !', invalid: 'Durée illisible', workPhase: 'Travail — session {n}', shortPhase: 'Pause courte',
    longPhase: 'Longue pause', toWork: 'Au travail ! Session {n}', toPause: 'C’est l’heure de la pause'
  },
  en: {
    title: 'Timer', subtitle: 'Countdown, stopwatch and pomodoro. Keeps running when you switch tabs.',
    countdown: 'Countdown', stopwatch: 'Stopwatch', durationHint: '5:00, 1h30, 90s…', work: 'Work', short: 'Break',
    long: 'Long break', start: 'Start', pause: 'Pause', resume: 'Resume', lap: 'Lap', reset: 'Reset', sound: 'Sound',
    done: 'Time’s up!', invalid: 'Unreadable duration', workPhase: 'Work — session {n}', shortPhase: 'Short break',
    longPhase: 'Long break', toWork: 'Back to work! Session {n}', toPause: 'Time for a break'
  }
}

var $ = function (s) { return document.querySelector(s) }
var PRESETS = ['1:00', '5:00', '10:00', '15:00', '25:00', '45:00', '1:00:00']
var mode = 'countdown'
var running = false
var startedAt = 0
var accumulated = 0
var target = 5 * 60000
var laps = []
var lastPhase = null
var finished = false

function elapsed() { return accumulated + (running ? Date.now() - startedAt : 0) }

function beep() {
  if (!$('#sound').checked) return
  try {
    var ctx = new AudioContext()
    ;[0, 0.25, 0.5].forEach(function (t) {
      var o = ctx.createOscillator()
      var g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.2, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.2)
    })
  } catch (e) { /* audio indisponible */ }
}

function cfg() { return { work: +$('#pWork').value || 25, short: +$('#pShort').value || 5, long: +$('#pLong').value || 15, every: 4 } }

function tick() {
  var e = elapsed()
  var phase = $('#phase')
  if (mode === 'stopwatch') {
    $('#clock').textContent = TimerLogic.format(e, true)
    phase.textContent = ''
  } else if (mode === 'countdown') {
    var left = target - e
    $('#clock').textContent = TimerLogic.format(Math.max(0, left))
    if (left <= 0 && running && !finished) {
      finished = true
      toggle()
      beep()
      outilo.toast(outilo.t('done'), 'success')
    }
    phase.textContent = finished ? outilo.t('done') : ''
  } else {
    var p = TimerLogic.pomodoro(e, cfg())
    $('#clock').textContent = TimerLogic.format(p.remaining)
    phase.className = 'phase ' + p.kind
    phase.textContent = p.kind === 'work' ? outilo.t('workPhase', { n: p.index }) : outilo.t(p.kind + 'Phase')
    var key = p.kind + p.index
    if (running && lastPhase && key !== lastPhase) {
      beep()
      outilo.toast(p.kind === 'work' ? outilo.t('toWork', { n: p.index }) : outilo.t('toPause'), 'info')
    }
    lastPhase = key
  }
}

function label() { $('#start').textContent = outilo.t(running ? 'pause' : elapsed() ? 'resume' : 'start') }

function toggle() {
  if (running) { accumulated = elapsed(); running = false }
  else {
    if (mode === 'countdown' && (finished || !accumulated)) {
      var d = TimerLogic.parseDuration($('#duration').value)
      if (!d) return outilo.toast(outilo.t('invalid'), 'error')
      if (finished) { accumulated = 0; finished = false }
      target = d
    }
    startedAt = Date.now()
    running = true
  }
  label()
  tick()
}

function reset() {
  running = false
  accumulated = 0
  finished = false
  lastPhase = null
  laps = []
  $('#laps').textContent = ''
  $('#laps').classList.add('hidden')
  target = TimerLogic.parseDuration($('#duration').value) || target
  label()
  tick()
}

function setMode(m) {
  mode = m
  document.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === m) })
  document.querySelectorAll('[data-for]').forEach(function (el) { el.classList.toggle('hidden', el.dataset.for !== m) })
  $('#lap').classList.toggle('hidden', m !== 'stopwatch')
  reset()
}

PRESETS.forEach(function (p) {
  var b = document.createElement('button')
  b.className = 'o-chip'
  b.textContent = p
  b.addEventListener('click', function () { $('#duration').value = p; reset() })
  $('#presets').appendChild(b)
})
document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode) }) })
$('#start').addEventListener('click', toggle)
$('#reset').addEventListener('click', reset)
$('#duration').addEventListener('change', reset)
$('#duration').addEventListener('keydown', function (e) { if (e.key === 'Enter') toggle() })
$('#lap').addEventListener('click', function () {
  if (!running) return
  laps.unshift(TimerLogic.format(elapsed(), true))
  $('#laps').classList.remove('hidden')
  $('#laps').textContent = laps.map(function (l, i) { return '#' + (laps.length - i) + '  ' + l }).join('\n')
})

outilo.onLocale(function () { label(); tick() })
outilo.onCommand(function (cmd) {
  if (cmd === 'pomodoro') { setMode('pomodoro'); toggle() }
  if (cmd === 'five') { setMode('countdown'); $('#duration').value = '5:00'; reset(); toggle() }
})
outilo.ready.then(function () { setMode('countdown'); setInterval(tick, 100) })
