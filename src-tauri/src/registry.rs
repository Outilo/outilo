//! Extensions installées : amorçage depuis le pack embarqué, découverte, mode développeur.
//!
//! Disposition sur disque :
//! `<root>/extensions/<id>/<version>/outilo.toml` pour les extensions installées,
//! `<root>/extensions.json` pour l'état (désactivées, retirées, dossiers de développement).

use crate::manifest::{self, Localized, Manifest};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Nombre de versions conservées par extension (courante + précédente pour retour arrière).
const KEEP_VERSIONS: usize = 2;

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Official,
    Dev,
}

#[derive(Debug, Clone)]
pub struct LoadedExt {
    pub manifest: Manifest,
    pub dir: PathBuf,
    pub source: Source,
    pub permissions: Vec<String>,
    /// Version précédente conservée sur disque (retour arrière possible).
    pub previous: Option<String>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ExtState {
    pub disabled: Vec<String>,
    pub removed: Vec<String>,
    pub dev: Vec<PathBuf>,
    /// Versions écartées par un retour arrière : ni réinstallées ni mises à jour automatiquement.
    pub skipped: BTreeMap<String, String>,
}

#[derive(Debug, Default)]
pub struct Registry {
    pub items: BTreeMap<String, LoadedExt>,
    pub warnings: Vec<String>,
}

/// Vue envoyée au shell.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtInfo {
    pub id: String,
    pub name: Localized,
    pub description: Option<Localized>,
    pub version: String,
    pub authors: Vec<String>,
    pub categories: Vec<String>,
    pub entry: String,
    pub icon: Option<String>,
    pub commands: Vec<manifest::CommandMeta>,
    pub permissions: Vec<String>,
    pub sensitive: Vec<String>,
    pub hosts: Vec<String>,
    pub previous: Option<String>,
    pub source: Source,
    pub enabled: bool,
    pub path: String,
}

impl ExtState {
    pub fn load(path: &Path) -> Self {
        fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        crate::fsutil::write_atomic(path, json.as_bytes())
    }
}

impl Registry {
    /// Amorce, découvre et charge toutes les extensions.
    pub fn load(installed: &Path, bundled: Option<&Path>, state: &ExtState) -> Self {
        let mut reg = Registry::default();
        if let Some(bundled) = bundled {
            if let Err(e) = seed(bundled, installed, state) {
                reg.warnings.push(e);
            }
        }
        reg.scan_installed(installed);
        reg.load_dev(state);
        reg
    }

    /// Développement de l'application : les extensions officielles sont servies directement depuis le dépôt,
    /// pour voir les modifications sans changer de version.
    pub fn load_live(repo: &Path, state: &ExtState) -> Self {
        let mut reg = Registry::default();
        for entry in fs::read_dir(repo).into_iter().flatten().flatten() {
            if !entry.path().is_dir() {
                continue;
            }
            match Manifest::load(&entry.path()) {
                Ok(m) if !state.removed.contains(&m.extension.id) => {
                    reg.insert(m, entry.path(), Source::Official, None)
                }
                Ok(_) => {}
                Err(e) => reg.warnings.push(e),
            }
        }
        reg.load_dev(state);
        reg
    }

    fn load_dev(&mut self, state: &ExtState) {
        for dir in &state.dev {
            match Manifest::load(dir) {
                Ok(m) => self.insert(m, dir.clone(), Source::Dev, None),
                Err(e) => self.warnings.push(format!("Développement : {e}")),
            }
        }
    }

    fn insert(&mut self, manifest: Manifest, dir: PathBuf, source: Source, previous: Option<String>) {
        let permissions = manifest.permission_names();
        self.items.insert(manifest.extension.id.clone(), LoadedExt { manifest, dir, source, permissions, previous });
    }

    fn scan_installed(&mut self, installed: &Path) {
        let Ok(entries) = fs::read_dir(installed) else { return };
        for entry in entries.flatten() {
            if !entry.path().is_dir() {
                continue;
            }
            let mut found = versions(&entry.path()).into_iter();
            match found.next() {
                Some((manifest, dir)) => {
                    let previous = found.next().map(|(m, _)| m.extension.version);
                    self.insert(manifest, dir, Source::Official, previous)
                }
                None => self.warnings.push(format!("{} : aucune version valide", entry.file_name().to_string_lossy())),
            }
        }
    }

    pub fn get(&self, id: &str) -> Option<&LoadedExt> {
        self.items.get(id)
    }

    pub fn has_permission(&self, id: &str, permission: &str) -> bool {
        self.get(id).is_some_and(|e| e.permissions.iter().any(|p| p == permission))
    }

    pub fn infos(&self, state: &ExtState) -> Vec<ExtInfo> {
        self.items
            .values()
            .map(|e| {
                let m = &e.manifest.extension;
                ExtInfo {
                    id: m.id.clone(),
                    name: m.name.clone(),
                    description: m.description.clone(),
                    version: m.version.clone(),
                    authors: m.authors.clone(),
                    categories: m.categories.clone(),
                    entry: e.manifest.ui.as_ref().map(|u| u.entry.replace('\\', "/")).unwrap_or_default(),
                    icon: m.icon.clone(),
                    commands: e.manifest.commands.clone(),
                    sensitive: e.permissions.iter().filter(|p| manifest::is_sensitive(p)).cloned().collect(),
                    permissions: e.permissions.clone(),
                    hosts: e.manifest.network_hosts(),
                    previous: e.previous.clone(),
                    source: e.source,
                    enabled: !state.disabled.contains(&m.id),
                    path: e.dir.display().to_string(),
                }
            })
            .collect()
    }
}

/// Plus haute version valide dans `<root>/extensions/<id>/`.
fn newest_version(ext_dir: &Path) -> Option<(Manifest, PathBuf)> {
    versions(ext_dir).into_iter().next()
}

/// La version `version` a été écartée par un retour arrière (ou une plus récente l'a été).
pub fn is_skipped(state: &ExtState, id: &str, version: &semver::Version) -> bool {
    state.skipped.get(id).and_then(|v| semver::Version::parse(v).ok()).is_some_and(|s| *version <= s)
}

/// Versions valides, de la plus récente à la plus ancienne.
pub fn versions(ext_dir: &Path) -> Vec<(Manifest, PathBuf)> {
    let mut found: Vec<(Manifest, PathBuf)> = fs::read_dir(ext_dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.path().is_dir())
        .filter_map(|e| Manifest::load(&e.path()).ok().map(|m| (m, e.path())))
        .collect();
    found.sort_by(|a, b| b.0.version().cmp(&a.0.version()));
    found
}

/// Copie les extensions embarquées absentes ou plus récentes que celles installées.
pub fn seed(bundled: &Path, installed: &Path, state: &ExtState) -> Result<(), String> {
    let entries = fs::read_dir(bundled).map_err(|e| format!("Pack embarqué illisible : {e}"))?;
    for entry in entries.flatten() {
        let src = entry.path();
        let Ok(manifest) = Manifest::load(&src) else { continue };
        let id = &manifest.extension.id;
        if state.removed.contains(id) || is_skipped(state, id, &manifest.version()) {
            continue;
        }
        let ext_dir = installed.join(id);
        let current = newest_version(&ext_dir).map(|(m, _)| m.version());
        if current.is_some_and(|v| v >= manifest.version()) {
            continue;
        }
        let staging = ext_dir.join(format!(".{}.tmp", manifest.extension.version));
        let _ = fs::remove_dir_all(&staging);
        crate::fsutil::copy_dir_all(&src, &staging).map_err(|e| format!("{id} : copie impossible : {e}"))?;
        commit(&ext_dir, &staging, &manifest.extension.version).map_err(|e| format!("{id} : {e}"))?;
    }
    Ok(())
}

/// Bascule un dossier préparé (`staging`) en `<ext_dir>/<version>` puis supprime les versions en trop.
pub fn commit(ext_dir: &Path, staging: &Path, version: &str) -> Result<(), String> {
    let target = ext_dir.join(version);
    let _ = fs::remove_dir_all(&target);
    fs::rename(staging, &target).map_err(|e| format!("installation impossible : {e}"))?;
    prune(ext_dir);
    Ok(())
}

fn prune(ext_dir: &Path) {
    for (_, dir) in versions(ext_dir).into_iter().skip(KEEP_VERSIONS) {
        let _ = fs::remove_dir_all(dir);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_ext(dir: &Path, id: &str, version: &str) {
        fs::create_dir_all(dir.join("ui")).unwrap();
        fs::write(
            dir.join("outilo.toml"),
            format!("[extension]\nid = \"{id}\"\nname = \"Test\"\nversion = \"{version}\"\napi = \"1\"\n\n[ui]\nentry = \"ui/index.html\"\n\n[permissions]\nclipboard = true\n"),
        )
        .unwrap();
        fs::write(dir.join("ui/index.html"), version).unwrap();
    }

    #[test]
    fn seeds_then_upgrades_and_keeps_previous() {
        let tmp = tempfile::tempdir().unwrap();
        let bundled = tmp.path().join("bundled");
        let installed = tmp.path().join("installed");

        write_ext(&bundled.join("a"), "test.a", "1.0.0");
        let reg = Registry::load(&installed, Some(&bundled), &ExtState::default());
        assert_eq!(reg.get("test.a").unwrap().manifest.extension.version, "1.0.0");

        // Nouvelle version embarquée : seule cette extension est remplacée
        fs::remove_dir_all(&bundled).unwrap();
        write_ext(&bundled.join("a"), "test.a", "1.1.0");
        let reg = Registry::load(&installed, Some(&bundled), &ExtState::default());
        assert_eq!(reg.get("test.a").unwrap().manifest.extension.version, "1.1.0");
        assert!(installed.join("test.a/1.0.0").exists(), "la version précédente est conservée");

        fs::remove_dir_all(&bundled).unwrap();
        write_ext(&bundled.join("a"), "test.a", "1.2.0");
        Registry::load(&installed, Some(&bundled), &ExtState::default());
        assert!(!installed.join("test.a/1.0.0").exists(), "au-delà de deux versions, la plus ancienne est supprimée");
        assert!(installed.join("test.a/1.1.0").exists());
    }

    #[test]
    fn removed_extensions_are_not_reseeded() {
        let tmp = tempfile::tempdir().unwrap();
        let bundled = tmp.path().join("bundled");
        let installed = tmp.path().join("installed");
        write_ext(&bundled.join("a"), "test.a", "1.0.0");
        let state = ExtState { removed: vec!["test.a".into()], ..Default::default() };
        let reg = Registry::load(&installed, Some(&bundled), &state);
        assert!(reg.get("test.a").is_none());
    }

    #[test]
    fn skipped_version_is_not_reseeded_and_previous_is_reported() {
        let tmp = tempfile::tempdir().unwrap();
        let bundled = tmp.path().join("bundled");
        let installed = tmp.path().join("installed");
        write_ext(&installed.join("test.a/1.0.0"), "test.a", "1.0.0");
        write_ext(&bundled.join("a"), "test.a", "1.1.0");
        let state = ExtState { skipped: [("test.a".into(), "1.1.0".into())].into(), ..Default::default() };
        let reg = Registry::load(&installed, Some(&bundled), &state);
        assert_eq!(reg.get("test.a").unwrap().manifest.extension.version, "1.0.0");
        assert!(reg.get("test.a").unwrap().previous.is_none());

        let reg = Registry::load(&installed, Some(&bundled), &ExtState::default());
        assert_eq!(reg.get("test.a").unwrap().previous.as_deref(), Some("1.0.0"));
    }

    #[test]
    fn live_mode_serves_repo_without_copy_and_honours_removed() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = tmp.path().join("repo");
        write_ext(&repo.join("a"), "test.a", "1.0.0");
        write_ext(&repo.join("b"), "test.b", "1.0.0");
        let state = ExtState { removed: vec!["test.b".into()], ..Default::default() };
        let reg = Registry::load_live(&repo, &state);
        assert_eq!(reg.get("test.a").unwrap().dir, repo.join("a"));
        assert!(reg.get("test.b").is_none());
    }

    #[test]
    fn dev_extension_overrides_and_reports_permissions() {
        let tmp = tempfile::tempdir().unwrap();
        let dev = tmp.path().join("dev");
        write_ext(&dev, "test.dev", "0.1.0");
        let state = ExtState { dev: vec![dev.clone()], disabled: vec!["test.dev".into()], ..Default::default() };
        let reg = Registry::load(&tmp.path().join("installed"), None, &state);
        assert!(reg.has_permission("test.dev", "clipboard"));
        assert!(!reg.has_permission("test.dev", "storage"));
        let info = &reg.infos(&state)[0];
        assert_eq!(info.source, Source::Dev);
        assert!(!info.enabled);
    }
}
