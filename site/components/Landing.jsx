import Link from 'next/link'

const features = [
  ['{ }', 'Tout est extension', "Chaque outil s'installe, se met à jour et se désinstalle indépendamment. L'application ne se retélécharge jamais pour un outil."],
  ['⚿', 'Sécurisé par défaut', 'Extensions isolées, paquets signés, permissions affichées avant installation. Aucun droit administrateur.'],
  ['⌘K', 'Pensé clavier', 'Palette de commandes, onglets, raccourcis : une interface d’IDE, pas un site web.'],
  ['◐', 'Thèmes libres', 'Réglages simples, fichier theme.toml ou CSS complet : modifiez absolument tout.'],
  ['TS', 'TypeScript ou Rust', 'Écrivez une extension en TS/JS, ou en Rust compilé en WebAssembly.'],
  ['⇣', '100 % local', 'Hors-ligne, données dans votre profil utilisateur, SQLite pour les extensions. Pas de télémétrie.']
]

const tools = {
  Développement: ['Mots de passe', 'Utilisateurs fictifs', 'JSON', 'JWT', 'Encodeurs', 'Hash', 'UUID / ULID', 'Regex', 'Timestamps', 'Cron'],
  'Système & quotidien': ['Nettoyeur', 'Ports & processus', 'Réseau', 'Infos système', 'Couleurs', 'QR code', 'Lorem ipsum']
}

const steps = [
  ['Installer', "Téléchargez l'installateur Windows (≈ 10 Mo)."],
  ['Choisir un profil', 'Développeur, webdesigner, DevOps, usage quotidien… Outilo installe le bon pack.'],
  ['Ajouter des outils', 'Parcourez le registre et installez ce dont vous avez besoin, quand vous en avez besoin.']
]

function AppPreview() {
  return (
    <div className="ol-win" aria-hidden="true">
      <div className="ol-win-bar">
        <i /><i /><i />
        <span className="ol-win-cmd">⌕ Rechercher un outil… <kbd>Ctrl K</kbd></span>
      </div>
      <div className="ol-win-main">
        <div className="ol-win-act">
          <b className="on" /><b /><b /><b />
        </div>
        <div className="ol-win-side">
          <small>Intégrés</small>
          <p className="on">** Mots de passe</p>
          <p>@ Utilisateurs fictifs</p>
          <p>{'{}'} JWT</p>
          <small>Système</small>
          <p>⌫ Nettoyeur</p>
          <p>⇄ Réseau</p>
        </div>
        <div className="ol-win-content">
          <div className="ol-win-tabs"><span className="on">Mots de passe</span><span>Utilisateurs</span></div>
          <div className="ol-win-body">
            <strong>Générateur de mots de passe</strong>
            <div className="ol-win-out">
              <code>k7#Rq!vM2p@Lx9$Wd4z</code>
              <span>Copier</span>
            </div>
            <div className="ol-win-meter"><i /></div>
            <em>124 bits d'entropie · très fort</em>
            <div className="ol-win-chips"><span>A–Z</span><span>a–z</span><span>0–9</span><span>!@#$</span></div>
          </div>
        </div>
      </div>
      <div className="ol-win-status"><span>● Hors-ligne OK</span><span>17 extensions</span><span>FR</span></div>
    </div>
  )
}

export function Landing() {
  return (
    <div className="ol-landing">
      <section className="ol-hero">
        <div className="ol-hero-text">
          <span className="ol-badge">V1 en développement · tests internes</span>
          <h1>La boîte à outils <span>qui grandit</span> avec vous.</h1>
          <p>
            Outilo réunit les petits outils qu'on cherche tous les jours — mots de passe, données de test, JSON, JWT,
            réseau, nettoyage — dans une application Windows native, rapide et extensible.
          </p>
          <div className="ol-cta">
            <Link href="/docs/premiers-pas/installation/" className="ol-btn primary">Installer Outilo</Link>
            <Link href="/docs/" className="ol-btn">Lire la documentation</Link>
          </div>
          <p className="ol-meta">Open source · Apache-2.0 · Windows 10/11</p>
        </div>
        <AppPreview />
      </section>

      <section className="ol-section">
        <h2>Pourquoi Outilo</h2>
        <div className="ol-grid">
          {features.map(([icon, title, text]) => (
            <div className="ol-card" key={title}>
              <span className="ol-icon">{icon}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ol-section">
        <h2>17 extensions officielles au lancement</h2>
        <div className="ol-tools">
          {Object.entries(tools).map(([group, list]) => (
            <div className="ol-card" key={group}>
              <h3>{group}</h3>
              <div className="ol-chips">
                {list.map(t => <span key={t}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ol-section">
        <h2>En trois étapes</h2>
        <ol className="ol-steps">
          {steps.map(([title, text], i) => (
            <li className="ol-card" key={title}>
              <span className="ol-step">{String(i + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ol-section ol-dev">
        <div>
          <h2>Créez vos propres outils</h2>
          <p>
            Un manifeste, une interface web, et optionnellement un module Rust. Outilo s'occupe de l'isolation, des
            permissions, du thème et des mises à jour.
          </p>
          <Link href="/docs/extensions/creer-une-extension/" className="ol-btn primary">Créer une extension</Link>
        </div>
        <pre className="ol-code">
          <code>{`# outilo.toml
[extension]
id       = "outilo.password"
name     = "Mots de passe"
version  = "1.2.0"
api      = "1"
license  = "Apache-2.0"

[permissions]
clipboard = "write"`}</code>
        </pre>
      </section>
    </div>
  )
}
