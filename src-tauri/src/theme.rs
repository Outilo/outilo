//! Thèmes : fichiers `theme.toml` (tokens) intégrés ou importés dans `<root>/themes/`.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

/// Thèmes livrés avec l'application.
pub const BUILTIN: &[&str] =
    &[include_str!("../themes/atelier-dark.toml"), include_str!("../themes/atelier-light.toml")];

/// Tokens de couleur reconnus.
pub const COLOR_TOKENS: &[&str] =
    &["bg", "surface", "surface-2", "border", "text", "muted", "accent", "accent-ink", "success", "danger"];

const MAX_CSS: usize = 100 * 1024;

#[derive(Debug, Deserialize)]
struct ThemeFile {
    meta: Meta,
    #[serde(default)]
    colors: BTreeMap<String, String>,
    #[serde(default)]
    shape: Shape,
    #[serde(default)]
    font: Font,
    #[serde(default)]
    css: Css,
}

#[derive(Debug, Deserialize)]
struct Meta {
    id: String,
    name: String,
    mode: String,
}

#[derive(Debug, Default, Deserialize)]
struct Shape {
    radius: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct Font {
    ui: Option<String>,
    mono: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct Css {
    code: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ThemeDef {
    pub id: String,
    pub name: String,
    pub mode: String,
    pub colors: BTreeMap<String, String>,
    pub radius: Option<String>,
    pub font_ui: Option<String>,
    pub font_mono: Option<String>,
    pub css: Option<String>,
    pub builtin: bool,
}

pub fn parse(source: &str, builtin: bool) -> Result<ThemeDef, String> {
    let file: ThemeFile = toml::from_str(source).map_err(|e| format!("theme.toml invalide : {e}"))?;
    let id = file.meta.id;
    if id.is_empty() || id.len() > 48 || !id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err("meta.id invalide (minuscules, chiffres et tirets)".into());
    }
    if file.meta.mode != "dark" && file.meta.mode != "light" {
        return Err("meta.mode doit valoir « dark » ou « light »".into());
    }
    for (key, value) in &file.colors {
        if !COLOR_TOKENS.contains(&key.as_str()) {
            return Err(format!("couleur inconnue « {key} »"));
        }
        check_value(value)?;
    }
    for value in [&file.shape.radius, &file.font.ui, &file.font.mono].into_iter().flatten() {
        check_value(value)?;
    }
    if file.css.code.as_ref().is_some_and(|c| c.len() > MAX_CSS) {
        return Err("CSS personnalisé trop long (100 Ko maximum)".into());
    }
    Ok(ThemeDef {
        id,
        name: file.meta.name,
        mode: file.meta.mode,
        colors: file.colors,
        radius: file.shape.radius,
        font_ui: file.font.ui,
        font_mono: file.font.mono,
        css: file.css.code,
        builtin,
    })
}

/// Une valeur de token devient une variable CSS : on interdit ce qui permettrait d'en sortir.
fn check_value(value: &str) -> Result<(), String> {
    let ok = value.len() <= 80 && value.chars().all(|c| c.is_ascii_alphanumeric() || " #(),.%-_'\"".contains(c));
    if ok {
        Ok(())
    } else {
        Err(format!("valeur invalide « {value} »"))
    }
}

pub fn list(user_dir: &Path) -> (Vec<ThemeDef>, Vec<String>) {
    let mut themes: Vec<ThemeDef> = BUILTIN.iter().map(|s| parse(s, true).expect("thème intégré valide")).collect();
    let mut warnings = Vec::new();
    for entry in fs::read_dir(user_dir).into_iter().flatten().flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|e| e == "toml") {
            match fs::read_to_string(&path).map_err(|e| e.to_string()).and_then(|s| parse(&s, false)) {
                Ok(t) if !themes.iter().any(|b| b.id == t.id) => themes.push(t),
                Ok(t) => warnings.push(format!("{} : identifiant déjà utilisé ({})", path.display(), t.id)),
                Err(e) => warnings.push(format!("{} : {e}", path.display())),
            }
        }
    }
    (themes, warnings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_themes_are_valid() {
        for src in BUILTIN {
            let t = parse(src, true).unwrap();
            for token in COLOR_TOKENS {
                assert!(t.colors.contains_key(*token), "{} : token {token} manquant", t.id);
            }
        }
    }

    #[test]
    fn rejects_css_injection_in_tokens() {
        let src =
            "[meta]\nid = \"x\"\nname = \"X\"\nmode = \"dark\"\n[colors]\naccent = \"red; } body { display:none\"\n";
        assert!(parse(src, false).is_err());
    }

    #[test]
    fn rejects_unknown_token_and_mode() {
        assert!(parse("[meta]\nid = \"x\"\nname = \"X\"\nmode = \"dark\"\n[colors]\nfoo = \"#fff\"\n", false).is_err());
        assert!(parse("[meta]\nid = \"x\"\nname = \"X\"\nmode = \"blue\"\n", false).is_err());
    }

    #[test]
    fn user_theme_cannot_shadow_builtin() {
        let tmp = tempfile::tempdir().unwrap();
        fs::write(tmp.path().join("a.toml"), "[meta]\nid = \"atelier-dark\"\nname = \"Faux\"\nmode = \"dark\"\n")
            .unwrap();
        fs::write(tmp.path().join("b.toml"), "[meta]\nid = \"nord\"\nname = \"Nord\"\nmode = \"dark\"\n").unwrap();
        let (themes, warnings) = list(tmp.path());
        assert_eq!(themes.iter().filter(|t| t.id == "atelier-dark").count(), 1);
        assert!(themes.iter().any(|t| t.id == "nord"));
        assert_eq!(warnings.len(), 1);
    }
}
