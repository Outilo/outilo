// Packs d'onboarding. Ceux du registre en ligne (modifiables sans mettre à jour l'application) ont la priorité ;
// scripts/packs.json sert de valeur par défaut et alimente aussi l'index publié.
import packs from '../../scripts/packs.json'
import { store } from './store'

export interface Profile {
  id: string
  emoji: string
  pack: string[]
}

const EMOJI: Record<string, string> = { dev: '💻', design: '🎨', ops: '🛠️', daily: '🏠' }

export const PROFILES: Profile[] = Object.entries(packs as Record<string, string[]>).map(([id, pack]) => ({
  id,
  emoji: EMOJI[id] ?? '⭐',
  pack
}))

export function packOf(profile: Profile): string[] {
  return store.registry.packs[profile.id] ?? profile.pack
}
