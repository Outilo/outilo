import nextra from 'nextra'

const withNextra = nextra({
  search: { codeblocks: false },
  defaultShowCopyCode: true
})

export default withNextra({
  // Export statique pour GitHub Pages (domaine personnalisé outilo.xyz, pas de basePath)
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true
})
