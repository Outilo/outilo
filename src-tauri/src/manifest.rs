//! Lecture et validation du manifeste `outilo.toml` d'une extension.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Component, Path};

/// Version de l'API Outilo supportée par cette application.
pub const API_VERSION: &str = "1";

/// Permissions connues : (nom, sensible).
pub const KNOWN_PERMISSIONS: &[(&str, bool)] = &[
    ("clipboard", false),
    ("storage", false),
    ("storage.sql", false),
    ("files.save", false),
    ("files.pick", false),
    ("system.info", false),
    ("network", false),
    ("files.scoped", true),
    ("process", true),
    ("shell.safe", true),
];

/// Texte simple ou traduit : `name = "Mots de passe"` ou `name = { fr = "…", en = "…" }`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Localized {
    Text(String),
    Map(BTreeMap<String, String>),
}

#[derive(Debug, Clone, Deserialize)]
pub struct Manifest {
    pub extension: ExtensionMeta,
    #[serde(default)]
    pub ui: Option<UiMeta>,
    #[serde(default)]
    pub commands: Vec<CommandMeta>,
    #[serde(default)]
    pub permissions: toml::Table,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExtensionMeta {
    pub id: String,
    pub name: Localized,
    #[serde(default)]
    pub description: Option<Localized>,
    pub version: String,
    pub api: String,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub authors: Vec<String>,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UiMeta {
    pub entry: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandMeta {
    pub id: String,
    pub title: Localized,
}

impl Manifest {
    pub fn parse(source: &str) -> Result<Self, String> {
        let manifest: Manifest = toml::from_str(source).map_err(|e| format!("outilo.toml invalide : {e}"))?;
        manifest.validate()?;
        Ok(manifest)
    }

    pub fn load(dir: &Path) -> Result<Self, String> {
        let path = dir.join("outilo.toml");
        let source = std::fs::read_to_string(&path).map_err(|e| format!("{} : {e}", path.display()))?;
        Self::parse(&source)
    }

    pub fn version(&self) -> semver::Version {
        // Validé dans `validate`
        semver::Version::parse(&self.extension.version).expect("version validée")
    }

    /// Permissions sous forme de clés pointées (`files.save`), quelle que soit l'écriture TOML.
    pub fn permission_names(&self) -> Vec<String> {
        let mut out = Vec::new();
        flatten("", &self.permissions, &mut out);
        out.sort();
        out
    }

    /// Domaines autorisés par `network = ["api.exemple.com", "*.exemple.org"]` (`"*"` : tous).
    pub fn network_hosts(&self) -> Vec<String> {
        match self.permissions.get("network") {
            Some(toml::Value::Array(hosts)) => {
                hosts.iter().filter_map(|h| h.as_str()).map(|h| h.to_ascii_lowercase()).collect()
            }
            _ => Vec::new(),
        }
    }

    fn validate(&self) -> Result<(), String> {
        let meta = &self.extension;
        if !is_valid_id(&meta.id) {
            return Err(format!("identifiant invalide « {} » (attendu : auteur.nom, en minuscules)", meta.id));
        }
        semver::Version::parse(&meta.version).map_err(|e| format!("{} : version invalide : {e}", meta.id))?;
        if meta.api != API_VERSION {
            return Err(format!(
                "{} cible l'API {} ; cette version d'Outilo supporte l'API {API_VERSION}",
                meta.id, meta.api
            ));
        }
        let ui = self.ui.as_ref().ok_or_else(|| format!("{} : section [ui] manquante", meta.id))?;
        if !is_safe_relative(&ui.entry) {
            return Err(format!("{} : chemin [ui].entry invalide", meta.id));
        }
        if let Some(icon) = &meta.icon {
            if !is_safe_relative(icon) {
                return Err(format!("{} : chemin d'icône invalide", meta.id));
            }
        }
        for perm in self.permission_names() {
            if !KNOWN_PERMISSIONS.iter().any(|(name, _)| *name == perm) {
                return Err(format!("{} : permission inconnue « {perm} »", meta.id));
            }
        }
        match self.permissions.get("network") {
            None | Some(toml::Value::Boolean(false)) => {}
            Some(toml::Value::Array(hosts))
                if !hosts.is_empty() && hosts.iter().all(|h| h.as_str().is_some_and(is_valid_host_pattern)) => {}
            Some(_) => {
                return Err(format!("{} : network attend une liste de domaines, ex. [\"api.exemple.com\"]", meta.id))
            }
        }
        Ok(())
    }
}

pub fn is_sensitive(permission: &str) -> bool {
    KNOWN_PERMISSIONS.iter().any(|(name, sensitive)| *name == permission && *sensitive)
}

fn flatten(prefix: &str, table: &toml::Table, out: &mut Vec<String>) {
    for (key, value) in table {
        let name = if prefix.is_empty() { key.clone() } else { format!("{prefix}.{key}") };
        match value {
            toml::Value::Table(inner) if !KNOWN_PERMISSIONS.iter().any(|(n, _)| *n == name) => {
                flatten(&name, inner, out)
            }
            toml::Value::Boolean(false) => {}
            _ => out.push(name),
        }
    }
}

/// `auteur.nom` : segments en minuscules, chiffres et tirets.
pub fn is_valid_id(id: &str) -> bool {
    let parts: Vec<&str> = id.split('.').collect();
    parts.len() >= 2
        && id.len() <= 64
        && parts.iter().all(|p| {
            !p.is_empty()
                && !p.starts_with('-')
                && p.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        })
}

/// `exemple.com`, `*.exemple.com` ou `*`.
fn is_valid_host_pattern(host: &str) -> bool {
    let name = host.strip_prefix("*.").unwrap_or(host);
    host == "*"
        || (!name.is_empty()
            && name.len() <= 253
            && name.split('.').all(|l| !l.is_empty() && l.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')))
}

/// Chemin relatif sans `..`, sans racine ni lecteur.
pub fn is_safe_relative(path: &str) -> bool {
    !path.is_empty() && Path::new(path).components().all(|c| matches!(c, Component::Normal(_) | Component::CurDir))
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = r#"
[extension]
id = "outilo.password"
name = { fr = "Mots de passe", en = "Passwords" }
version = "1.2.0"
api = "1"
categories = ["securite"]

[ui]
entry = "ui/index.html"

[[commands]]
id = "copy-24"
title = "Copier"

[permissions]
clipboard = true
files.save = true
"#;

    #[test]
    fn parses_valid_manifest() {
        let m = Manifest::parse(VALID).unwrap();
        assert_eq!(m.extension.id, "outilo.password");
        assert_eq!(m.version(), semver::Version::new(1, 2, 0));
        assert_eq!(m.permission_names(), vec!["clipboard", "files.save"]);
        assert_eq!(m.commands.len(), 1);
    }

    #[test]
    fn rejects_unknown_permission() {
        let src = VALID.replace("clipboard = true", "root = true");
        assert!(Manifest::parse(&src).unwrap_err().contains("permission inconnue"));
    }

    #[test]
    fn rejects_wrong_api() {
        let src = VALID.replace("api = \"1\"", "api = \"2\"");
        assert!(Manifest::parse(&src).is_err());
    }

    #[test]
    fn rejects_path_traversal() {
        let src = VALID.replace("ui/index.html", "../../secret.html");
        assert!(Manifest::parse(&src).is_err());
        assert!(!is_safe_relative("C:\\Windows\\win.ini"));
        assert!(!is_safe_relative("/etc/passwd"));
        assert!(is_safe_relative("ui/main.js"));
    }

    #[test]
    fn validates_ids() {
        assert!(is_valid_id("outilo.fake-user"));
        assert!(!is_valid_id("password"));
        assert!(!is_valid_id("Outilo.Password"));
        assert!(!is_valid_id("outilo..x"));
    }

    #[test]
    fn network_requires_host_list() {
        let src = VALID.replace("clipboard = true", "network = [\"api.ipify.org\", \"*.exemple.org\"]");
        assert_eq!(Manifest::parse(&src).unwrap().network_hosts(), vec!["api.ipify.org", "*.exemple.org"]);
        assert!(Manifest::parse(&VALID.replace("clipboard = true", "network = true")).is_err());
        assert!(Manifest::parse(&VALID.replace("clipboard = true", "network = [\"a b\"]")).is_err());
    }

    #[test]
    fn official_extensions_are_valid() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../extensions");
        let mut count = 0;
        for entry in std::fs::read_dir(&dir).unwrap().flatten().filter(|e| e.path().is_dir()) {
            Manifest::load(&entry.path()).unwrap_or_else(|e| panic!("{e}"));
            count += 1;
        }
        assert!(count >= 17, "{count} extensions officielles");
    }

    #[test]
    fn false_permission_is_ignored() {
        let src = VALID.replace("clipboard = true", "clipboard = false");
        assert_eq!(Manifest::parse(&src).unwrap().permission_names(), vec!["files.save"]);
    }
}
