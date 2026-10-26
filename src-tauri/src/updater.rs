//! Mise à jour de l'application : `latest.json` publié avec la dernière Release `v*`, installateur signé avec la
//! même clé que les extensions. L'installateur NSIS (mode utilisateur, sans droits administrateur) est relancé
//! en mode mise à jour : `/P` (sans assistant), `/R` (relance d'Outilo), `/UPDATE`.

use crate::remote;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub const DEFAULT_URL: &str = "https://github.com/Outilo/outilo/releases/latest/download/latest.json";
const MAX_INSTALLER: u64 = 200 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Latest {
    pub version: String,
    #[serde(default)]
    pub notes: String,
    pub url: String,
    pub sha256: String,
    pub signature: String,
    #[serde(default)]
    pub size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub current: String,
    pub latest: String,
    pub available: bool,
    pub notes: String,
    pub size: u64,
}

pub fn url() -> String {
    std::env::var("OUTILO_APP_UPDATE").unwrap_or_else(|_| DEFAULT_URL.to_owned())
}

pub fn compare(current: &str, latest: &Latest) -> UpdateInfo {
    let newer = match (semver::Version::parse(current), semver::Version::parse(&latest.version)) {
        (Ok(c), Ok(l)) => l > c,
        _ => false,
    };
    UpdateInfo {
        current: current.to_owned(),
        latest: latest.version.clone(),
        available: newer,
        notes: latest.notes.clone(),
        size: latest.size,
    }
}

pub fn fetch(url: &str) -> Result<Latest, String> {
    let bytes = remote::get_bytes(url, 64 * 1024)?;
    serde_json::from_slice(&bytes).map_err(|e| format!("latest.json invalide : {e}"))
}

/// Télécharge et vérifie l'installateur ; renvoie son chemin dans `dir`.
pub fn download(latest: &Latest, dir: &Path) -> Result<PathBuf, String> {
    if latest.size > MAX_INSTALLER {
        return Err("installateur trop volumineux".into());
    }
    let bytes = remote::get_bytes(&latest.url, MAX_INSTALLER)?;
    verify(&bytes, latest, &remote::trusted_keys())?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("Outilo_{}_setup.exe", sanitize(&latest.version)));
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

fn sanitize(v: &str) -> String {
    v.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-').collect()
}

pub fn verify(bytes: &[u8], latest: &Latest, keys: &[ed25519_dalek::VerifyingKey]) -> Result<(), String> {
    if keys.is_empty() {
        return Err("aucune clé de signature configurée".into());
    }
    let digest: String = Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect();
    if !digest.eq_ignore_ascii_case(&latest.sha256) {
        return Err("empreinte SHA-256 de l'installateur invalide".into());
    }
    let sig = B64
        .decode(&latest.signature)
        .ok()
        .and_then(|b| ed25519_dalek::Signature::from_slice(&b).ok())
        .ok_or("signature de l'installateur illisible")?;
    if keys.iter().any(|k| k.verify_strict(bytes, &sig).is_ok()) {
        Ok(())
    } else {
        Err("signature de l'installateur invalide".into())
    }
}

/// Lance l'installateur en mode mise à jour ; l'appelant quitte ensuite Outilo.
pub fn launch(installer: &Path) -> Result<(), String> {
    std::process::Command::new(installer)
        .args(["/P", "/R", "/UPDATE"])
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("impossible de lancer l'installateur : {e}"))
}

/// Supprime les installateurs téléchargés lors d'une mise à jour précédente.
pub fn cleanup(dir: &Path) {
    let _ = fs::remove_dir_all(dir);
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    fn latest(version: &str, bytes: &[u8], key: &SigningKey) -> Latest {
        Latest {
            version: version.into(),
            notes: String::new(),
            url: String::new(),
            sha256: Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect(),
            signature: B64.encode(key.sign(bytes).to_bytes()),
            size: bytes.len() as u64,
        }
    }

    #[test]
    fn detects_newer_versions_only() {
        let key = SigningKey::from_bytes(&[1; 32]);
        assert!(compare("0.5.0", &latest("0.6.0", b"x", &key)).available);
        assert!(!compare("0.6.0", &latest("0.6.0", b"x", &key)).available);
        assert!(!compare("0.7.0", &latest("0.6.0", b"x", &key)).available);
        assert!(!compare("0.5.0", &latest("pas-une-version", b"x", &key)).available);
    }

    #[test]
    fn verifies_installer_signature() {
        let key = SigningKey::from_bytes(&[1; 32]);
        let l = latest("0.6.0", b"installateur", &key);
        assert!(verify(b"installateur", &l, &[key.verifying_key()]).is_ok());
        assert!(verify(b"autre chose", &l, &[key.verifying_key()]).is_err());
        assert!(verify(b"installateur", &l, &[SigningKey::from_bytes(&[2; 32]).verifying_key()]).is_err());
        assert!(verify(b"installateur", &l, &[]).is_err());
        assert_eq!(sanitize("1.2.3/../x"), "1.2.3..x");
    }
}
