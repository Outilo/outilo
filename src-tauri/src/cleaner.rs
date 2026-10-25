//! Nettoyeur (permission `files.scoped`) : liste **fixe** de caches situés dans le profil de l'utilisateur.
//! L'extension ne choisit jamais un chemin ; elle désigne des cibles par identifiant.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

pub struct Target {
    pub id: &'static str,
    pub group: &'static str,
    pub label_fr: &'static str,
    pub label_en: &'static str,
}

pub const TARGETS: &[Target] = &[
    Target { id: "temp", group: "system", label_fr: "Fichiers temporaires", label_en: "Temporary files" },
    Target { id: "crash-dumps", group: "system", label_fr: "Rapports de plantage", label_en: "Crash dumps" },
    Target { id: "recycle-bin", group: "system", label_fr: "Corbeille", label_en: "Recycle Bin" },
    Target { id: "chrome", group: "browser", label_fr: "Cache de Chrome", label_en: "Chrome cache" },
    Target { id: "edge", group: "browser", label_fr: "Cache d'Edge", label_en: "Edge cache" },
    Target { id: "brave", group: "browser", label_fr: "Cache de Brave", label_en: "Brave cache" },
    Target { id: "firefox", group: "browser", label_fr: "Cache de Firefox", label_en: "Firefox cache" },
    Target { id: "npm", group: "dev", label_fr: "Cache npm", label_en: "npm cache" },
    Target { id: "pnpm", group: "dev", label_fr: "Cache pnpm", label_en: "pnpm cache" },
    Target { id: "yarn", group: "dev", label_fr: "Cache Yarn", label_en: "Yarn cache" },
    Target { id: "pip", group: "dev", label_fr: "Cache pip", label_en: "pip cache" },
    Target {
        id: "cargo",
        group: "dev",
        label_fr: "Archives Cargo téléchargées",
        label_en: "Downloaded Cargo archives",
    },
];

/// Dossiers de base, injectables pour les tests.
pub struct Roots {
    pub profile: PathBuf,
    pub local: PathBuf,
    pub temp: PathBuf,
}

impl Roots {
    pub fn from_env() -> Option<Self> {
        let var = |k: &str| std::env::var_os(k).map(PathBuf::from);
        Some(Self { profile: var("USERPROFILE")?, local: var("LOCALAPPDATA")?, temp: std::env::temp_dir() })
    }
}

/// Profils Chromium (`Default`, `Profile 1`…) : leurs caches sont dans chaque sous-dossier.
fn chromium(user_data: PathBuf) -> Vec<PathBuf> {
    let mut out = vec![user_data.join("ShaderCache"), user_data.join("GrShaderCache")];
    for entry in fs::read_dir(&user_data).into_iter().flatten().flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name == "Default" || name.starts_with("Profile ") {
            for sub in ["Cache", "Code Cache", "GPUCache"] {
                out.push(entry.path().join(sub));
            }
        }
    }
    out
}

pub fn paths(id: &str, r: &Roots) -> Vec<PathBuf> {
    let l = &r.local;
    let candidates = match id {
        "temp" => vec![r.temp.clone()],
        "crash-dumps" => vec![l.join("CrashDumps")],
        "chrome" => chromium(l.join(r"Google\Chrome\User Data")),
        "edge" => chromium(l.join(r"Microsoft\Edge\User Data")),
        "brave" => chromium(l.join(r"BraveSoftware\Brave-Browser\User Data")),
        "firefox" => fs::read_dir(l.join(r"Mozilla\Firefox\Profiles"))
            .into_iter()
            .flatten()
            .flatten()
            .map(|e| e.path().join("cache2"))
            .collect(),
        "npm" => vec![l.join(r"npm-cache\_cacache")],
        "pnpm" => vec![l.join("pnpm-cache")],
        "yarn" => vec![l.join(r"Yarn\Cache")],
        "pip" => vec![l.join(r"pip\Cache")],
        "cargo" => vec![r.profile.join(r".cargo\registry\cache")],
        _ => vec![],
    };
    // Garde-fou : rien en dehors du profil utilisateur
    candidates.into_iter().filter(|p| p.starts_with(&r.profile) && p.is_dir()).collect()
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub bytes: u64,
    pub files: u64,
}

/// Taille d'un dossier, sans suivre les liens symboliques ni les jonctions.
fn measure(dir: &Path, usage: &mut Usage) {
    for entry in fs::read_dir(dir).into_iter().flatten().flatten() {
        let Ok(meta) = entry.path().symlink_metadata() else { continue };
        if meta.file_type().is_symlink() {
            continue;
        }
        if meta.is_dir() {
            measure(&entry.path(), usage);
        } else {
            usage.bytes += meta.len();
            usage.files += 1;
        }
    }
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Cleaned {
    pub bytes: u64,
    pub files: u64,
    /// Fichiers ignorés (en cours d'utilisation, protégés).
    pub skipped: u64,
}

/// Vide le contenu d'un dossier (le dossier lui-même est conservé). Les liens ne sont jamais suivis ni supprimés.
fn empty_dir(dir: &Path, out: &mut Cleaned) {
    for entry in fs::read_dir(dir).into_iter().flatten().flatten() {
        let path = entry.path();
        let Ok(meta) = path.symlink_metadata() else { continue };
        if meta.file_type().is_symlink() {
            out.skipped += 1;
        } else if meta.is_dir() {
            empty_dir(&path, out);
            let _ = fs::remove_dir(&path);
        } else if fs::remove_file(&path).is_ok() {
            out.bytes += meta.len();
            out.files += 1;
        } else {
            out.skipped += 1;
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetUsage {
    id: &'static str,
    group: &'static str,
    label: &'static str,
    bytes: u64,
    files: u64,
    found: bool,
}

pub fn label(t: &Target, locale: &str) -> &'static str {
    if locale == "en" {
        t.label_en
    } else {
        t.label_fr
    }
}

pub fn scan(r: &Roots, locale: &str) -> Vec<TargetUsage> {
    TARGETS
        .iter()
        .map(|t| {
            let (usage, found) = if t.id == "recycle-bin" {
                recycle_bin_usage().map_or((Usage::default(), false), |u| (u, true))
            } else {
                let dirs = paths(t.id, r);
                let mut usage = Usage::default();
                dirs.iter().for_each(|d| measure(d, &mut usage));
                (usage, !dirs.is_empty())
            };
            TargetUsage {
                id: t.id,
                group: t.group,
                label: label(t, locale),
                bytes: usage.bytes,
                files: usage.files,
                found,
            }
        })
        .collect()
}

pub fn clean(ids: &[String], r: &Roots) -> Cleaned {
    let mut out = Cleaned::default();
    for id in ids {
        if id == "recycle-bin" {
            if let Some(usage) = recycle_bin_usage() {
                if empty_recycle_bin() {
                    out.bytes += usage.bytes;
                    out.files += usage.files;
                }
            }
            continue;
        }
        for dir in paths(id, r) {
            empty_dir(&dir, &mut out);
        }
    }
    out
}

pub fn is_known(id: &str) -> bool {
    TARGETS.iter().any(|t| t.id == id)
}

#[cfg(windows)]
fn recycle_bin_usage() -> Option<Usage> {
    use windows_sys::Win32::UI::Shell::{SHQueryRecycleBinW, SHQUERYRBINFO};
    let mut info = SHQUERYRBINFO { cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32, ..Default::default() };
    // SAFETY : structure initialisée avec sa taille ; racine nulle = toutes les corbeilles.
    let hr = unsafe { SHQueryRecycleBinW(std::ptr::null(), &mut info) };
    (hr == 0).then(|| Usage { bytes: info.i64Size.max(0) as u64, files: info.i64NumItems.max(0) as u64 })
}

#[cfg(windows)]
fn empty_recycle_bin() -> bool {
    use windows_sys::Win32::UI::Shell::{SHEmptyRecycleBinW, SHERB_NOCONFIRMATION, SHERB_NOPROGRESSUI, SHERB_NOSOUND};
    // SAFETY : fenêtre et racine nulles ; la confirmation a déjà été demandée par Outilo.
    let hr = unsafe {
        SHEmptyRecycleBinW(
            std::ptr::null_mut(),
            std::ptr::null(),
            SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND,
        )
    };
    hr == 0
}

#[cfg(not(windows))]
fn recycle_bin_usage() -> Option<Usage> {
    None
}

#[cfg(not(windows))]
fn empty_recycle_bin() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn roots(base: &Path) -> Roots {
        let profile = base.join("profile");
        Roots { local: profile.join(r"AppData\Local"), temp: profile.join(r"AppData\Local\Temp"), profile }
    }

    #[test]
    fn cleans_only_known_folders_inside_profile() {
        let tmp = tempfile::tempdir().unwrap();
        let r = roots(tmp.path());
        let npm = r.local.join(r"npm-cache\_cacache");
        fs::create_dir_all(npm.join("sub")).unwrap();
        fs::write(npm.join("a.bin"), [0u8; 100]).unwrap();
        fs::write(npm.join("sub/b.bin"), [0u8; 50]).unwrap();
        let keep = r.local.join(r"npm-cache\keep.txt");
        fs::write(&keep, "garder").unwrap();
        let outside = tmp.path().join("outside");
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("x"), "x").unwrap();

        let scan = scan(&r, "fr");
        let item = scan.iter().find(|t| t.id == "npm").unwrap();
        assert_eq!((item.bytes, item.files, item.found), (150, 2, true));
        assert!(!scan.iter().find(|t| t.id == "pip").unwrap().found);

        let done = clean(&["npm".into(), "inconnu".into()], &r);
        assert_eq!((done.bytes, done.files), (150, 2));
        assert!(npm.is_dir(), "le dossier racine est conservé");
        assert!(!npm.join("sub").exists());
        assert!(keep.exists() && outside.join("x").exists());
    }

    #[test]
    fn refuses_paths_outside_profile() {
        let tmp = tempfile::tempdir().unwrap();
        let mut r = roots(tmp.path());
        r.temp = tmp.path().join("ailleurs");
        fs::create_dir_all(&r.temp).unwrap();
        assert!(paths("temp", &r).is_empty());
    }

    #[test]
    fn finds_chromium_profiles() {
        let tmp = tempfile::tempdir().unwrap();
        let r = roots(tmp.path());
        let ud = r.local.join(r"Google\Chrome\User Data");
        for d in [r"Default\Cache", r"Profile 2\Code Cache", r"System Profile\Cache"] {
            fs::create_dir_all(ud.join(d)).unwrap();
        }
        let found = paths("chrome", &r);
        assert_eq!(found.len(), 2, "{found:?}");
    }
}

#[cfg(test)]
mod machine_tests {
    use super::*;

    /// Analyse réelle du profil, sans rien supprimer.
    #[test]
    fn scans_real_profile_without_deleting() {
        let roots = Roots::from_env().unwrap();
        let list = scan(&roots, "fr");
        assert_eq!(list.len(), TARGETS.len());
        assert!(list.iter().find(|t| t.id == "temp").unwrap().found);
    }
}
