//! Utilitaires de fichiers.

use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

pub fn copy_dir_all(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let target = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_all(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

/// Écrit dans un fichier temporaire puis renomme, pour ne jamais laisser un fichier à moitié écrit.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

/// Résout `rel` dans `base` en refusant toute sortie du dossier (`..`, chemins absolus, liens).
pub fn resolve_inside(base: &Path, rel: &str) -> Option<PathBuf> {
    let rel = Path::new(rel);
    if !rel.components().all(|c| matches!(c, Component::Normal(_) | Component::CurDir)) {
        return None;
    }
    let candidate = base.join(rel).canonicalize().ok()?;
    let base = base.canonicalize().ok()?;
    (candidate.starts_with(&base) && candidate.is_file()).then_some(candidate)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_inside_blocks_escapes() {
        let tmp = tempfile::tempdir().unwrap();
        let base = tmp.path().join("ext");
        fs::create_dir_all(base.join("ui")).unwrap();
        fs::write(base.join("ui/index.html"), "ok").unwrap();
        fs::write(tmp.path().join("secret.txt"), "no").unwrap();

        assert!(resolve_inside(&base, "ui/index.html").is_some());
        assert!(resolve_inside(&base, "../secret.txt").is_none());
        assert!(resolve_inside(&base, "ui/../../secret.txt").is_none());
        assert!(resolve_inside(&base, tmp.path().join("secret.txt").to_str().unwrap()).is_none());
        assert!(resolve_inside(&base, "ui").is_none(), "un dossier n'est pas servi");
    }
}
