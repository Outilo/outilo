//! Registre en ligne : index des extensions officielles, téléchargement, vérification et installation
//! d'**une** extension, sans toucher à l'application ni aux autres extensions.
//!
//! Chaque paquet `.outilo` (archive zip) est signé en ed25519 par la CI ; la clé publique est intégrée à
//! l'application (`keys/registry.pub`). Sans clé configurée, l'installation en ligne est refusée.

use crate::manifest::{self, Localized, Manifest};
use crate::registry::{self, ExtState, Registry, Source};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Index publié par la CI sur la branche `registry` du dépôt de l'application.
pub const DEFAULT_URL: &str = "https://raw.githubusercontent.com/Outilo/outilo/registry/index.json";

/// Clés publiques de confiance (base64, une par ligne, `#` pour commenter).
const TRUSTED_KEYS: &str = include_str!("../keys/registry.pub");

const MAX_INDEX: u64 = 2 * 1024 * 1024;
const MAX_PACKAGE: u64 = 30 * 1024 * 1024;
const MAX_UNPACKED: u64 = 100 * 1024 * 1024;
const MAX_FILES: usize = 2000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Index {
    pub schema: u32,
    #[serde(default)]
    pub generated: String,
    #[serde(default)]
    pub extensions: BTreeMap<String, IndexExt>,
    /// Packs d'onboarding : profil → extensions.
    #[serde(default)]
    pub packs: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexExt {
    pub name: Localized,
    #[serde(default)]
    pub description: Option<Localized>,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub authors: Vec<String>,
    /// Publiée par l'équipe Outilo (identifiant `outilo.*`).
    #[serde(default)]
    pub verified: bool,
    pub versions: BTreeMap<String, IndexVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexVersion {
    pub api: String,
    pub url: String,
    pub sha256: String,
    pub signature: String,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub size: u64,
}

impl Index {
    /// Plus haute version compatible avec l'API de cette application.
    pub fn candidate(&self, id: &str) -> Option<(semver::Version, &IndexVersion)> {
        self.extensions
            .get(id)?
            .versions
            .iter()
            .filter(|(_, v)| v.api == manifest::API_VERSION)
            .filter_map(|(k, v)| semver::Version::parse(k).ok().map(|s| (s, v)))
            .max_by(|a, b| a.0.cmp(&b.0))
    }
}

/// Une extension du registre, comparée à ce qui est installé.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Available {
    pub id: String,
    pub name: Localized,
    pub description: Option<Localized>,
    pub categories: Vec<String>,
    pub authors: Vec<String>,
    pub verified: bool,
    pub version: String,
    pub installed: Option<String>,
    pub update: bool,
    pub permissions: Vec<String>,
    /// Permissions demandées par la nouvelle version et absentes de la version installée.
    pub new_permissions: Vec<String>,
    /// Version écartée par un retour arrière : jamais appliquée automatiquement.
    pub skipped: bool,
    pub size: u64,
}

pub fn compare(index: &Index, reg: &Registry, state: &ExtState) -> Vec<Available> {
    index
        .extensions
        .iter()
        .filter_map(|(id, ext)| {
            let (version, entry) = index.candidate(id)?;
            let local = reg.get(id);
            // Une extension en développement ou locale masque celle du registre
            if local.is_some_and(|l| l.source != Source::Official) {
                return None;
            }
            let installed = local.map(|l| l.manifest.version());
            let new_permissions = match local {
                Some(l) => entry.permissions.iter().filter(|p| !l.permissions.contains(p)).cloned().collect(),
                None => Vec::new(),
            };
            Some(Available {
                id: id.clone(),
                name: ext.name.clone(),
                description: ext.description.clone(),
                categories: ext.categories.clone(),
                authors: ext.authors.clone(),
                verified: ext.verified,
                update: installed.as_ref().is_some_and(|i| *i < version),
                installed: installed.map(|v| v.to_string()),
                skipped: registry::is_skipped(state, id, &version),
                version: version.to_string(),
                permissions: entry.permissions.clone(),
                new_permissions,
                size: entry.size,
            })
        })
        .collect()
}

// ---------- Réseau ----------

pub fn registry_url() -> String {
    std::env::var("OUTILO_REGISTRY").unwrap_or_else(|_| DEFAULT_URL.to_owned())
}

pub fn agent(timeout: Duration) -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(timeout))
        .http_status_as_error(false)
        .user_agent(concat!("Outilo/", env!("CARGO_PKG_VERSION")))
        .build()
        .into()
}

enum Fetched {
    NotModified,
    Body(Vec<u8>, Option<String>),
}

/// `file:///D:/registre/index.json` → chemin local (tests et développement).
fn local_path(url: &str) -> Option<PathBuf> {
    let rest = url.strip_prefix("file://")?;
    let rest = rest.strip_prefix('/').filter(|r| r.as_bytes().get(1) == Some(&b':')).unwrap_or(rest);
    Some(PathBuf::from(rest))
}

fn get(url: &str, etag: Option<&str>, limit: u64) -> Result<Fetched, String> {
    if let Some(path) = local_path(url) {
        let bytes = fs::read(&path).map_err(|e| format!("{} : {e}", path.display()))?;
        return if bytes.len() as u64 > limit {
            Err("fichier trop volumineux".into())
        } else {
            Ok(Fetched::Body(bytes, None))
        };
    }
    if !url.starts_with("https://") {
        return Err(format!("adresse refusée (https obligatoire) : {url}"));
    }
    let mut req = agent(Duration::from_secs(60)).get(url);
    if let Some(tag) = etag {
        req = req.header("If-None-Match", tag);
    }
    let mut res = req.call().map_err(|e| format!("réseau : {e}"))?;
    match res.status().as_u16() {
        304 => Ok(Fetched::NotModified),
        200 => {
            let tag = res.headers().get("etag").and_then(|v| v.to_str().ok()).map(str::to_owned);
            let body = res.body_mut().with_config().limit(limit).read_to_vec().map_err(|e| format!("réseau : {e}"))?;
            Ok(Fetched::Body(body, tag))
        }
        code => Err(format!("le registre a répondu {code}")),
    }
}

/// Téléchargement simple (https ou file://), limité à `limit` octets.
pub fn get_bytes(url: &str, limit: u64) -> Result<Vec<u8>, String> {
    match get(url, None, limit)? {
        Fetched::Body(bytes, _) => Ok(bytes),
        Fetched::NotModified => Err("réponse inattendue".into()),
    }
}

#[derive(Serialize, Deserialize)]
struct Cache {
    url: String,
    etag: Option<String>,
    index: Index,
}

pub struct Fetch {
    pub index: Index,
    /// Le registre est injoignable : l'index vient du cache local.
    pub offline: Option<String>,
}

/// Télécharge l'index (requête conditionnelle `If-None-Match`) ; repli sur le cache hors ligne.
pub fn fetch_index(url: &str, cache_file: &Path) -> Result<Fetch, String> {
    let cache: Option<Cache> = fs::read_to_string(cache_file)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .filter(|c: &Cache| c.url == url);
    match get(url, cache.as_ref().and_then(|c| c.etag.as_deref()), MAX_INDEX) {
        Ok(Fetched::NotModified) if cache.is_some() => Ok(Fetch { index: cache.expect("cache").index, offline: None }),
        Ok(Fetched::NotModified) => Err("réponse 304 sans cache local".into()),
        Ok(Fetched::Body(bytes, etag)) => {
            let index: Index =
                serde_json::from_slice(&bytes).map_err(|e| format!("index du registre invalide : {e}"))?;
            if index.schema != 1 {
                return Err(format!("format de registre {} non pris en charge : mettez Outilo à jour", index.schema));
            }
            let cache = Cache { url: url.to_owned(), etag, index };
            if let Ok(json) = serde_json::to_vec(&cache) {
                let _ = crate::fsutil::write_atomic(cache_file, &json);
            }
            Ok(Fetch { index: cache.index, offline: None })
        }
        Err(e) => match cache {
            Some(c) => Ok(Fetch { index: c.index, offline: Some(e) }),
            None => Err(e),
        },
    }
}

pub fn download(entry: &IndexVersion) -> Result<Vec<u8>, String> {
    if entry.size > MAX_PACKAGE {
        return Err("paquet trop volumineux".into());
    }
    match get(&entry.url, None, MAX_PACKAGE)? {
        Fetched::Body(bytes, _) => Ok(bytes),
        Fetched::NotModified => Err("réponse inattendue".into()),
    }
}

// ---------- Vérification & installation ----------

pub fn trusted_keys() -> Vec<VerifyingKey> {
    let mut lines: Vec<String> = TRUSTED_KEYS.lines().map(str::to_owned).collect();
    if cfg!(debug_assertions) {
        // Clé de test locale, jamais lue par une version publiée
        lines.extend(std::env::var("OUTILO_DEV_PUBKEY").ok());
    }
    lines.iter().map(|l| l.trim()).filter(|l| !l.is_empty() && !l.starts_with('#')).filter_map(parse_key).collect()
}

fn parse_key(b64: &str) -> Option<VerifyingKey> {
    let bytes: [u8; 32] = B64.decode(b64).ok()?.try_into().ok()?;
    VerifyingKey::from_bytes(&bytes).ok()
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn verify(bytes: &[u8], entry: &IndexVersion, keys: &[VerifyingKey]) -> Result<(), String> {
    if keys.is_empty() {
        return Err("aucune clé de signature configurée : installation en ligne désactivée".into());
    }
    if !hex(&Sha256::digest(bytes)).eq_ignore_ascii_case(&entry.sha256) {
        return Err("empreinte SHA-256 du paquet invalide".into());
    }
    let signature = B64
        .decode(&entry.signature)
        .ok()
        .and_then(|b| Signature::from_slice(&b).ok())
        .ok_or("signature du paquet illisible")?;
    if keys.iter().any(|k| k.verify_strict(bytes, &signature).is_ok()) {
        Ok(())
    } else {
        Err("signature du paquet invalide".into())
    }
}

/// Décompresse en refusant les chemins qui sortent du dossier et les archives démesurées.
pub fn unpack(bytes: &[u8], dest: &Path) -> Result<(), String> {
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| format!("paquet illisible : {e}"))?;
    if zip.len() > MAX_FILES {
        return Err("paquet trop volumineux".into());
    }
    let mut total = 0u64;
    for i in 0..zip.len() {
        let mut file = zip.by_index(i).map_err(|e| format!("paquet illisible : {e}"))?;
        let Some(rel) = file.enclosed_name() else {
            return Err("chemin interdit dans le paquet".into());
        };
        let out = dest.join(rel);
        if file.is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut buf = Vec::new();
        file.by_ref().take(MAX_UNPACKED - total + 1).read_to_end(&mut buf).map_err(|e| e.to_string())?;
        total += buf.len() as u64;
        if total > MAX_UNPACKED {
            return Err("paquet trop volumineux une fois décompressé".into());
        }
        fs::write(&out, buf).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Vérifie puis installe le paquet dans `<installed>/<id>/<version>/` (la version précédente est conservée).
pub fn install(
    bytes: &[u8],
    id: &str,
    version: &semver::Version,
    entry: &IndexVersion,
    installed: &Path,
    keys: &[VerifyingKey],
) -> Result<(), String> {
    if !manifest::is_valid_id(id) {
        return Err(format!("identifiant invalide : {id}"));
    }
    verify(bytes, entry, keys)?;
    let ext_dir = installed.join(id);
    let staging = ext_dir.join(format!(".{version}.tmp"));
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
    let checked = unpack(bytes, &staging).and_then(|_| {
        let m = Manifest::load(&staging)?;
        if m.extension.id != id || m.version() != *version {
            return Err(format!(
                "le paquet contient {} {} au lieu de {id} {version}",
                m.extension.id, m.extension.version
            ));
        }
        Ok(m)
    });
    match checked {
        Ok(m) => registry::commit(&ext_dir, &staging, &m.extension.version),
        Err(e) => {
            let _ = fs::remove_dir_all(&staging);
            Err(e)
        }
    }
}

/// Supprime la version courante pour revenir à la précédente. Renvoie (version écartée, version active).
pub fn rollback(installed: &Path, id: &str) -> Result<(String, String), String> {
    if !manifest::is_valid_id(id) {
        return Err(format!("identifiant invalide : {id}"));
    }
    let found = registry::versions(&installed.join(id));
    let [(newest, dir), (previous, _), ..] = found.as_slice() else {
        return Err("aucune version précédente conservée".into());
    };
    fs::remove_dir_all(dir).map_err(|e| e.to_string())?;
    Ok((newest.extension.version.clone(), previous.extension.version.clone()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use std::io::Write;

    fn manifest(id: &str, version: &str) -> String {
        format!("[extension]\nid = \"{id}\"\nname = \"Test\"\nversion = \"{version}\"\napi = \"1\"\n\n[ui]\nentry = \"ui/index.html\"\n\n[permissions]\nclipboard = true\n")
    }

    fn package(files: &[(&str, &str)]) -> Vec<u8> {
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        for (name, content) in files {
            zip.start_file(*name, opts).unwrap();
            zip.write_all(content.as_bytes()).unwrap();
        }
        zip.finish().unwrap().into_inner()
    }

    fn signed(bytes: &[u8], key: &SigningKey) -> IndexVersion {
        IndexVersion {
            api: "1".into(),
            url: String::new(),
            sha256: hex(&Sha256::digest(bytes)),
            signature: B64.encode(key.sign(bytes).to_bytes()),
            permissions: vec!["clipboard".into()],
            size: bytes.len() as u64,
        }
    }

    #[test]
    fn verifies_hash_and_signature() {
        let key = SigningKey::from_bytes(&[7; 32]);
        let other = SigningKey::from_bytes(&[8; 32]);
        let bytes = package(&[("outilo.toml", &manifest("test.a", "1.0.0"))]);
        let entry = signed(&bytes, &key);
        assert!(verify(&bytes, &entry, &[key.verifying_key()]).is_ok());
        assert!(verify(&bytes, &entry, &[other.verifying_key()]).unwrap_err().contains("signature"));
        assert!(verify(&bytes, &entry, &[]).unwrap_err().contains("aucune clé"));
        let mut tampered = bytes.clone();
        tampered[10] ^= 1;
        assert!(verify(&tampered, &entry, &[key.verifying_key()]).unwrap_err().contains("SHA-256"));
    }

    #[test]
    fn bundled_trusted_keys_are_valid() {
        let lines: Vec<&str> =
            TRUSTED_KEYS.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with('#')).collect();
        assert!(!lines.is_empty(), "keys/registry.pub ne contient aucune clé");
        for line in lines {
            assert!(parse_key(line).is_some(), "clé invalide dans keys/registry.pub : {line}");
        }
    }

    #[test]
    fn parses_trusted_key_lines() {
        let key = SigningKey::from_bytes(&[7; 32]);
        assert!(parse_key(&B64.encode(key.verifying_key().to_bytes())).is_some());
        assert!(parse_key("pas une clé").is_none());
    }

    #[test]
    fn installs_one_version_and_rolls_back() {
        let tmp = tempfile::tempdir().unwrap();
        let key = SigningKey::from_bytes(&[7; 32]);
        let keys = [key.verifying_key()];
        for v in ["1.0.0", "1.1.0"] {
            let bytes = package(&[("outilo.toml", &manifest("test.a", v)), ("ui/index.html", v)]);
            install(&bytes, "test.a", &semver::Version::parse(v).unwrap(), &signed(&bytes, &key), tmp.path(), &keys)
                .unwrap();
        }
        assert_eq!(fs::read_to_string(tmp.path().join("test.a/1.1.0/ui/index.html")).unwrap(), "1.1.0");
        assert!(tmp.path().join("test.a/1.0.0").exists());
        assert_eq!(rollback(tmp.path(), "test.a").unwrap(), ("1.1.0".into(), "1.0.0".into()));
        assert!(!tmp.path().join("test.a/1.1.0").exists());
        assert!(rollback(tmp.path(), "test.a").is_err(), "plus de version précédente");
    }

    #[test]
    fn rejects_mismatched_or_escaping_packages() {
        let tmp = tempfile::tempdir().unwrap();
        let key = SigningKey::from_bytes(&[7; 32]);
        let keys = [key.verifying_key()];
        let v = semver::Version::new(1, 0, 0);

        let wrong = package(&[("outilo.toml", &manifest("test.b", "1.0.0"))]);
        let err = install(&wrong, "test.a", &v, &signed(&wrong, &key), tmp.path(), &keys).unwrap_err();
        assert!(err.contains("au lieu de"));

        let evil = package(&[("outilo.toml", &manifest("test.a", "1.0.0")), ("../../evil.txt", "x")]);
        let err = install(&evil, "test.a", &v, &signed(&evil, &key), tmp.path(), &keys).unwrap_err();
        assert!(err.contains("chemin interdit"));
        assert!(!tmp.path().join("evil.txt").exists());
        assert!(!tmp.path().join("test.a/1.0.0").exists(), "rien n'est installé en cas d'échec");
    }

    #[test]
    fn compares_registry_with_installed() {
        let tmp = tempfile::tempdir().unwrap();
        let key = SigningKey::from_bytes(&[7; 32]);
        let bytes = package(&[("outilo.toml", &manifest("test.a", "1.0.0"))]);
        install(
            &bytes,
            "test.a",
            &semver::Version::new(1, 0, 0),
            &signed(&bytes, &key),
            tmp.path(),
            &[key.verifying_key()],
        )
        .unwrap();
        let reg = Registry::load(tmp.path(), None, &ExtState::default());

        let mut v2 = signed(b"x", &key);
        v2.permissions.push("network".into());
        let mut v3 = v2.clone();
        v3.api = "2".into();
        let index: Index = Index {
            schema: 1,
            generated: String::new(),
            extensions: [
                (
                    "test.a".to_owned(),
                    IndexExt {
                        name: Localized::Text("A".into()),
                        description: None,
                        categories: vec![],
                        authors: vec![],
                        verified: true,
                        versions: [
                            ("1.0.0".to_owned(), signed(b"y", &key)),
                            ("1.2.0".into(), v2),
                            ("2.0.0".into(), v3),
                        ]
                        .into(),
                    },
                ),
                (
                    "test.b".to_owned(),
                    IndexExt {
                        name: Localized::Text("B".into()),
                        description: None,
                        categories: vec![],
                        authors: vec![],
                        verified: true,
                        versions: [("0.1.0".to_owned(), signed(b"z", &key))].into(),
                    },
                ),
            ]
            .into(),
            packs: BTreeMap::new(),
        };
        let items = compare(&index, &reg, &ExtState::default());
        let a = items.iter().find(|i| i.id == "test.a").unwrap();
        assert_eq!(a.version, "1.2.0", "la version 2.0.0 cible une autre API");
        assert!(a.update);
        assert_eq!(a.new_permissions, vec!["network"]);
        let b = items.iter().find(|i| i.id == "test.b").unwrap();
        assert!(!b.update && b.installed.is_none());

        let state = ExtState { skipped: [("test.a".into(), "1.2.0".into())].into(), ..Default::default() };
        assert!(compare(&index, &reg, &state).iter().find(|i| i.id == "test.a").unwrap().skipped);
    }

    /// Registre produit par `scripts/release-extensions.mjs` : la CI et l'application doivent s'accorder.
    /// Lancé si OUTILO_TEST_REGISTRY (dossier contenant index.json et out/) et OUTILO_TEST_PUBKEY sont définis.
    #[test]
    fn accepts_registry_built_by_release_script() {
        let (Ok(dir), Some(key)) = (
            std::env::var("OUTILO_TEST_REGISTRY"),
            std::env::var("OUTILO_TEST_PUBKEY").ok().and_then(|k| parse_key(&k)),
        ) else {
            return;
        };
        let dir = PathBuf::from(dir);
        let index: Index = serde_json::from_slice(&fs::read(dir.join("index.json")).unwrap()).unwrap();
        let tmp = tempfile::tempdir().unwrap();
        for id in index.extensions.keys() {
            let (version, entry) = index.candidate(id).unwrap();
            let bytes = fs::read(dir.join("out").join(format!("{id}-{version}.outilo"))).unwrap();
            install(&bytes, id, &version, entry, tmp.path(), &[key]).unwrap_or_else(|e| panic!("{id} : {e}"));
        }
        let reg = Registry::load(tmp.path(), None, &ExtState::default());
        assert_eq!(reg.items.len(), index.extensions.len(), "{:?}", reg.warnings);
    }

    #[test]
    fn local_registry_paths() {
        assert_eq!(local_path("file:///D:/reg/index.json").unwrap(), PathBuf::from("D:/reg/index.json"));
        assert_eq!(local_path("file:///tmp/index.json").unwrap(), PathBuf::from("/tmp/index.json"));
        assert!(local_path("https://exemple.com").is_none());
    }
}
