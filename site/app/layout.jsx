import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head, Search } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import { Inter, JetBrains_Mono } from 'next/font/google'
import 'nextra-theme-docs/style.css'
import './site.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-ui' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata = {
  metadataBase: new URL('https://outilo.xyz'),
  title: { default: 'Outilo — la boîte à outils extensible', template: '%s · Outilo' },
  description:
    "Outilo : application de bureau open source qui réunit vos outils du quotidien (mots de passe, données de test, JSON, réseau…) et s'enrichit d'extensions."
}

const logo = (
  <span className="ol-logo">
    <span className="ol-logo-mark">O</span>
    <span>Outilo</span>
  </span>
)

export default async function RootLayout({ children }) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <Head
        color={{ hue: 38, saturation: 92, lightness: { dark: 55, light: 42 } }}
        backgroundColor={{ dark: '#0f1115', light: '#f6f7f9' }}
        faviconGlyph="🧰"
      />
      <body>
        <Layout
          navbar={<Navbar logo={logo} projectLink="https://github.com/outilo" />}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/outilo/outilo/tree/main/site"
          footer={<Footer>Apache-2.0 · {new Date().getFullYear()} © Outilo</Footer>}
          nextThemes={{ defaultTheme: 'dark' }}
          search={<Search placeholder="Rechercher dans la doc…" emptyResult="Aucun résultat." />}
          editLink="Modifier cette page sur GitHub"
          feedback={{ content: 'Une question ? Ouvrez un ticket', labels: 'documentation' }}
          toc={{ title: 'Sur cette page', backToTop: 'Revenir en haut' }}
          themeSwitch={{ dark: 'Sombre', light: 'Clair', system: 'Système' }}
          sidebar={{ defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
