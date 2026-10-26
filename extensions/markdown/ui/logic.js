// Markdown → HTML (testé par tests/extensions/markdown.test.mjs). Analyse : marked (MIT), dans vendor/.
;(function (root) {
  'use strict'

  /** Retire scripts, cadres et gestionnaires d'évènements : le texte peut venir d'ailleurs (copier-coller). */
  function sanitize(html) {
    return html
      .replace(/<(script|style|iframe|object|embed|link|meta|base|form)\b[\s\S]*?(<\/\1\s*>|\/?>)/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src)\s*=\s*(["']?)\s*(javascript|vbscript|data:text\/html)[^"'\s>]*\2/gi, '$1="#"')
  }

  function render(md) {
    return sanitize(root.marked.parse(String(md), { gfm: true, breaks: false }))
  }

  function slug(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  }

  /** Titres du document, hors blocs de code. */
  function toc(md) {
    var out = []
    var inCode = false
    String(md).split('\n').forEach(function (line) {
      if (/^\s*(```|~~~)/.test(line)) inCode = !inCode
      var m = !inCode && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
      if (m) out.push({ level: m[1].length, text: m[2], id: slug(m[2]) })
    })
    return out
  }

  /** Page HTML autonome, lisible et imprimable. */
  function documentHtml(body, title) {
    var esc = String(title || 'Document').replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] })
    return '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<title>' + esc + '</title>\n<style>\n' +
      'body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#1f2328}\n' +
      'pre,code{font-family:ui-monospace,monospace;background:#f3f4f6;border-radius:6px}pre{padding:12px;overflow:auto}code{padding:1px 4px}\n' +
      'table{border-collapse:collapse}td,th{border:1px solid #d0d7de;padding:6px 10px}blockquote{border-left:4px solid #d0d7de;margin:0;padding-left:14px;color:#57606a}\n' +
      'img{max-width:100%}\n</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n'
  }

  root.MdLogic = { render: render, sanitize: sanitize, toc: toc, slug: slug, documentHtml: documentHtml }
})(typeof window !== 'undefined' ? window : globalThis)
