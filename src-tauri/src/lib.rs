//! Cœur d'Outilo : commandes exposées au shell (jamais aux extensions).

mod cleaner;
mod fsutil;
mod manifest;
mod net;
mod protocol;
mod registry;
mod remote;
mod sql;
mod storage;
mod system;
mod theme;
mod updater;

use manifest::Localized;
use registry::{ExtInfo, ExtState, Registry, Source};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State, WindowEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

pub struct Paths {
    pub root: PathBuf,
    pub extensions: PathBuf,
    pub data: PathBuf,
    pub themes: PathBuf,
    /// Extensions privées de l'utilisateur, hors du store.
    pub local: PathBuf,
    pub bundled: Option<PathBuf>,
    /// En développement : dossier `extensions/` du dépôt, servi sans copie.
    pub live: Option<PathBuf>,
}

impl Paths {
    fn settings(&self) -> PathBuf {
        self.root.join("settings.json")
    }
    fn ext_state(&self) -> PathBuf {
        self.root.join("extensions.json")
    }
    fn registry_cache(&self) -> PathBuf {
        self.root.join("registry-cache.json")
    }
    fn dev_links(&self) -> PathBuf {
        self.root.join("dev-links.json")
    }
    fn updates(&self) -> PathBuf {
        self.root.join("updates")
    }
}

/// Options du shell appliquées par le cœur (zone de notification, raccourci global).
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShellOptions {
    close_to_tray: bool,
    shortcut: Option<String>,
    locale: String,
}

pub struct AppState {
    pub paths: Paths,
    pub registry: Mutex<Registry>,
    pub ext_state: Mutex<ExtState>,
    sys: Mutex<sysinfo::System>,
    index: Mutex<Option<remote::Index>>,
    shell: Mutex<ShellOptions>,
}

impl AppState {
    fn state_snapshot(&self) -> ExtState {
        self.ext_state.lock().expect("état").clone()
    }

    fn reload(&self) {
        let st = self.state_snapshot();
        *self.registry.lock().expect("registre") = load_registry(&self.paths, &st);
    }

    fn list(&self) -> ExtList {
        let st = self.state_snapshot();
        let reg = self.registry.lock().expect("registre");
        ExtList { items: reg.infos(&st), warnings: reg.warnings.clone() }
    }

    fn update_state(&self, f: impl FnOnce(&mut ExtState)) -> Result<(), String> {
        let mut st = self.ext_state.lock().expect("état");
        f(&mut st);
        st.save(&self.paths.ext_state())
    }

    fn require(&self, id: &str, permission: &str) -> Result<(), String> {
        if self.registry.lock().expect("registre").has_permission(id, permission) {
            Ok(())
        } else {
            Err(format!("{id} n'a pas la permission « {permission} »"))
        }
    }

    /// Domaines déclarés par l'extension (permission `network` vérifiée).
    fn hosts(&self, id: &str) -> Result<Vec<String>, String> {
        self.require(id, "network")?;
        Ok(self.registry.lock().expect("registre").get(id).map(|e| e.manifest.network_hosts()).unwrap_or_default())
    }

    fn locale(&self) -> String {
        fs::read_to_string(self.paths.settings())
            .ok()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .and_then(|v| v.get("locale").and_then(Value::as_str).map(str::to_owned))
            .unwrap_or_else(|| "fr".into())
    }

    fn ext_name(&self, id: &str, locale: &str) -> String {
        let reg = self.registry.lock().expect("registre");
        match reg.get(id).map(|e| &e.manifest.extension.name) {
            Some(Localized::Text(s)) => s.clone(),
            Some(Localized::Map(m)) => m.get(locale).or_else(|| m.get("fr")).cloned().unwrap_or_else(|| id.into()),
            None => id.into(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    version: String,
    data_dir: String,
    ext_base_url: &'static str,
    api: &'static str,
    registry_url: String,
    signed_updates: bool,
}

#[derive(Serialize)]
struct ExtList {
    items: Vec<ExtInfo>,
    warnings: Vec<String>,
}

#[derive(Serialize)]
struct ThemeList {
    themes: Vec<theme::ThemeDef>,
    warnings: Vec<String>,
}

/// Exécute un travail bloquant (réseau, disque) hors du fil de l'interface.
async fn blocking<T: Send + 'static>(
    app: AppHandle,
    f: impl FnOnce(&AppHandle, &AppState) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || f(&app, &app.state::<AppState>())).await.map_err(|e| e.to_string())?
}

/// Confirmation native : le texte est composé par le cœur, jamais par l'extension.
fn confirm(app: &AppHandle, title: &str, message: &str, ok: &str, locale: &str) -> bool {
    let cancel = if locale == "en" { "Cancel" } else { "Annuler" };
    app.dialog()
        .message(message)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(ok.into(), cancel.into()))
        .blocking_show()
}

#[tauri::command]
fn app_info(app: AppHandle, state: State<AppState>) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
        data_dir: state.paths.root.display().to_string(),
        ext_base_url: protocol::BASE_URL,
        api: manifest::API_VERSION,
        registry_url: remote::registry_url(),
        signed_updates: !remote::trusted_keys().is_empty(),
    }
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> Value {
    fs::read_to_string(state.paths.settings())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| Value::Object(Default::default()))
}

#[tauri::command]
fn save_settings(state: State<AppState>, settings: Value) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fsutil::write_atomic(&state.paths.settings(), json.as_bytes())
}

#[tauri::command]
fn list_extensions(state: State<AppState>) -> ExtList {
    state.list()
}

#[tauri::command]
fn reload_extensions(state: State<AppState>) -> ExtList {
    state.reload();
    state.list()
}

#[tauri::command]
fn set_extension_enabled(state: State<AppState>, id: String, enabled: bool) -> Result<ExtList, String> {
    state.update_state(|st| {
        st.disabled.retain(|d| d != &id);
        if !enabled {
            st.disabled.push(id.clone());
        }
    })?;
    Ok(state.list())
}

#[tauri::command]
fn uninstall_extension(state: State<AppState>, id: String) -> Result<ExtList, String> {
    let source = state.registry.lock().expect("registre").get(&id).map(|e| (e.source, e.dir.clone()));
    match source {
        Some((Source::Dev, dir)) => {
            unlink_dev(&state.paths, &dir);
            state.update_state(|st| st.dev.retain(|d| d != &dir))?
        }
        Some((Source::Local, dir)) => {
            if dir.starts_with(&state.paths.local) {
                fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
            }
        }
        Some((Source::Official, _)) => {
            if manifest::is_valid_id(&id) {
                let _ = fs::remove_dir_all(state.paths.extensions.join(&id));
            }
            state.update_state(|st| {
                if !st.removed.contains(&id) {
                    st.removed.push(id.clone());
                }
            })?;
        }
        None => return Err(format!("extension inconnue : {id}")),
    }
    state.reload();
    Ok(state.list())
}

/// Installe une extension privée depuis un dossier ou un fichier `.outilo` (non signé) : elle reste sur ce PC,
/// n'est jamais envoyée au store et n'est pas mise à jour par le registre.
#[tauri::command]
async fn install_local(app: AppHandle, from_file: bool) -> Result<Option<ExtList>, String> {
    blocking(app, move |app, state| {
        let dialog = app.dialog().file();
        let picked = if from_file {
            dialog.add_filter("Extension Outilo", &["outilo", "zip"]).blocking_pick_file()
        } else {
            dialog.blocking_pick_folder()
        };
        let Some(picked) = picked else { return Ok(None) };
        let source = picked.into_path().map_err(|e| e.to_string())?;

        // Préparation dans un dossier temporaire du profil, puis contrôles
        let staging = state.paths.local.join(".import.tmp");
        let _ = fs::remove_dir_all(&staging);
        fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
        let prepared = if from_file {
            fs::read(&source).map_err(|e| e.to_string()).and_then(|bytes| remote::unpack(&bytes, &staging))
        } else {
            fsutil::copy_dir_all(&source, &staging).map_err(|e| e.to_string())
        };
        let checked = prepared.and_then(|_| manifest::Manifest::load(&staging));
        let m = match checked {
            Ok(m) => m,
            Err(e) => {
                let _ = fs::remove_dir_all(&staging);
                return Err(e);
            }
        };
        let id = m.extension.id.clone();
        let taken = state.registry.lock().expect("registre").get(&id).is_some_and(|e| e.source != Source::Local);
        if id.starts_with("outilo.") || taken {
            let _ = fs::remove_dir_all(&staging);
            return Err(format!("« {id} » est l'identifiant d'une extension officielle : choisissez-en un autre"));
        }

        let locale = state.locale();
        let name = match &m.extension.name {
            Localized::Text(s) => s.clone(),
            Localized::Map(map) => map.get(&locale).or_else(|| map.get("fr")).cloned().unwrap_or_else(|| id.clone()),
        };
        let perms = m.permission_names();
        let list = if perms.is_empty() {
            "—".to_owned()
        } else {
            perms
                .iter()
                .map(|p| if manifest::is_sensitive(p) { format!("• {p} ⚠") } else { format!("• {p}") })
                .collect::<Vec<_>>()
                .join("\n")
        };
        let (title, message, ok) = if locale == "en" {
            ("Install a local extension", format!("{name} ({id}) {}\n\nThis extension was not reviewed by the Outilo team. Only install code you trust.\n\nPermissions:\n{list}", m.extension.version), "Install")
        } else {
            ("Installer une extension locale", format!("{name} ({id}) {}\n\nCette extension n'a pas été vérifiée par l'équipe Outilo. N'installez que du code en lequel vous avez confiance.\n\nPermissions :\n{list}", m.extension.version), "Installer")
        };
        if !confirm(app, title, &message, ok, &locale) {
            let _ = fs::remove_dir_all(&staging);
            return Ok(None);
        }
        let target = state.paths.local.join(&id);
        let _ = fs::remove_dir_all(&target);
        fs::rename(&staging, &target).map_err(|e| format!("installation impossible : {e}"))?;
        state.update_state(|st| st.removed.retain(|r| r != &id))?;
        state.reload();
        Ok(Some(state.list()))
    })
    .await
}

#[tauri::command]
fn restore_official_extensions(state: State<AppState>) -> Result<ExtList, String> {
    state.update_state(|st| st.removed.clear())?;
    state.reload();
    Ok(state.list())
}

/// Extensions livrées avec l'application, installées ou non : catalogue disponible hors ligne.
#[tauri::command]
fn list_bundled(state: State<AppState>) -> Vec<registry::BundledInfo> {
    state.paths.bundled.as_deref().or(state.paths.live.as_deref()).map(registry::bundled).unwrap_or_default()
}

/// Premier lancement : seules les extensions choisies sont installées, les autres restent au catalogue.
#[tauri::command]
fn choose_extensions(state: State<AppState>, ids: Vec<String>) -> Result<ExtList, String> {
    let offered: Vec<String> = list_bundled(state.clone()).into_iter().map(|b| b.id).collect();
    for id in offered.iter().filter(|id| !ids.contains(id)) {
        if manifest::is_valid_id(id) {
            let _ = fs::remove_dir_all(state.paths.extensions.join(id));
        }
    }
    state.update_state(|st| {
        st.removed.retain(|r| !ids.contains(r));
        for id in offered.into_iter().filter(|id| !ids.contains(id)) {
            if !st.removed.contains(&id) {
                st.removed.push(id);
            }
        }
    })?;
    state.reload();
    Ok(state.list())
}

/// Installe une extension du pack embarqué (sans réseau).
#[tauri::command]
fn install_bundled(state: State<AppState>, id: String) -> Result<ExtList, String> {
    state.update_state(|st| {
        st.removed.retain(|r| r != &id);
        st.skipped.remove(&id);
    })?;
    state.reload();
    Ok(state.list())
}

#[tauri::command]
async fn add_dev_extension(app: AppHandle, state: State<'_, AppState>) -> Result<Option<ExtList>, String> {
    let Some(picked) = app.dialog().file().blocking_pick_folder() else { return Ok(None) };
    let dir = picked.into_path().map_err(|e| e.to_string())?;
    manifest::Manifest::load(&dir)?;
    state.update_state(|st| {
        if !st.dev.contains(&dir) {
            st.dev.push(dir.clone());
        }
    })?;
    state.reload();
    Ok(Some(state.list()))
}

// ---------- Registre en ligne ----------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CheckResult {
    items: Vec<remote::Available>,
    packs: BTreeMap<String, Vec<String>>,
    generated: String,
    offline: Option<String>,
}

#[tauri::command]
async fn registry_check(app: AppHandle) -> Result<CheckResult, String> {
    blocking(app, |_, state| {
        let fetch = remote::fetch_index(&remote::registry_url(), &state.paths.registry_cache())?;
        let items = {
            let reg = state.registry.lock().expect("registre");
            remote::compare(&fetch.index, &reg, &state.state_snapshot())
        };
        let result = CheckResult {
            items,
            packs: fetch.index.packs.clone(),
            generated: fetch.index.generated.clone(),
            offline: fetch.offline,
        };
        *state.index.lock().expect("index") = Some(fetch.index);
        Ok(result)
    })
    .await
}

#[tauri::command]
async fn registry_install(app: AppHandle, id: String) -> Result<ExtList, String> {
    blocking(app, move |_, state| {
        let (version, entry) = {
            let index = state.index.lock().expect("index");
            let index = index.as_ref().ok_or("vérifiez d'abord les mises à jour")?;
            let (v, e) = index.candidate(&id).ok_or_else(|| format!("{id} est absente du registre"))?;
            (v, e.clone())
        };
        let bytes = remote::download(&entry)?;
        remote::install(&bytes, &id, &version, &entry, &state.paths.extensions, &remote::trusted_keys())?;
        state.update_state(|st| {
            st.removed.retain(|r| r != &id);
            st.skipped.remove(&id);
        })?;
        state.reload();
        Ok(state.list())
    })
    .await
}

#[tauri::command]
fn registry_rollback(state: State<AppState>, id: String) -> Result<ExtList, String> {
    let (dropped, _) = remote::rollback(&state.paths.extensions, &id)?;
    state.update_state(|st| {
        st.skipped.insert(id.clone(), dropped);
    })?;
    state.reload();
    Ok(state.list())
}

// ---------- Mise à jour de l'application ----------

#[tauri::command]
async fn app_update_check(app: AppHandle) -> Result<updater::UpdateInfo, String> {
    blocking(app, |app, _| {
        let latest = updater::fetch(&updater::url())?;
        Ok(updater::compare(&app.package_info().version.to_string(), &latest))
    })
    .await
}

/// Télécharge, vérifie et lance l'installateur, puis quitte Outilo (relancé par l'installateur).
#[tauri::command]
async fn app_update_install(app: AppHandle) -> Result<(), String> {
    blocking(app, |app, state| {
        let latest = updater::fetch(&updater::url())?;
        if !updater::compare(&app.package_info().version.to_string(), &latest).available {
            return Err("Outilo est déjà à jour".into());
        }
        let installer = updater::download(&latest, &state.paths.updates())?;
        updater::launch(&installer)?;
        app.exit(0);
        Ok(())
    })
    .await
}

// ---------- API des extensions (permission vérifiée ici, en plus du shell) ----------

#[tauri::command]
fn ext_storage(
    state: State<AppState>,
    id: String,
    op: String,
    key: Option<String>,
    value: Option<Value>,
) -> Result<Value, String> {
    state.require(&id, "storage")?;
    let kv = storage::KvStore::new(&state.paths.data, &id);
    let key = || match &key {
        Some(k) if !k.is_empty() && k.len() <= 128 => Ok(k.as_str()),
        _ => Err("clé invalide".to_string()),
    };
    match op.as_str() {
        "get" => Ok(kv.get(key()?)),
        "set" => kv.set(key()?, value.unwrap_or(Value::Null)).map(|_| Value::Null),
        "remove" => kv.remove(key()?).map(|_| Value::Null),
        "keys" => Ok(Value::from(kv.keys())),
        _ => Err(format!("opération inconnue : {op}")),
    }
}

#[tauri::command]
async fn ext_sql(
    app: AppHandle,
    id: String,
    sql: String,
    params: Option<Vec<Value>>,
    script: Option<bool>,
) -> Result<Option<sql::QueryResult>, String> {
    blocking(app, move |_, state| {
        state.require(&id, "storage.sql")?;
        let conn = sql::open(&state.paths.data, &id)?;
        if script.unwrap_or(false) {
            sql::exec(&conn, &sql).map(|_| None)
        } else {
            sql::query(&conn, &sql, &params.unwrap_or_default()).map(Some)
        }
    })
    .await
}

#[tauri::command]
async fn ext_save_file(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    name: String,
    content: String,
    encoding: Option<String>,
) -> Result<bool, String> {
    state.require(&id, "files.save")?;
    // Fichiers binaires (PNG…) : contenu transmis en base64
    let bytes = match encoding.as_deref() {
        Some("base64") => {
            use base64::Engine;
            base64::engine::general_purpose::STANDARD
                .decode(content.as_bytes())
                .map_err(|_| "contenu base64 invalide")?
        }
        _ => content.into_bytes(),
    };
    save_with_dialog(&app, &name, &bytes)
}

fn save_with_dialog(app: &AppHandle, name: &str, content: &[u8]) -> Result<bool, String> {
    let name: String = name.chars().filter(|c| !"\\/:*?\"<>|".contains(*c)).take(120).collect();
    let Some(target) = app.dialog().file().set_file_name(&name).blocking_save_file() else { return Ok(false) };
    let path = target.into_path().map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
async fn ext_system_info(app: AppHandle, id: String) -> Result<system::SystemInfo, String> {
    blocking(app, move |_, state| {
        state.require(&id, "system.info")?;
        Ok(system::info(&mut state.sys.lock().expect("système")))
    })
    .await
}

#[tauri::command]
async fn ext_processes(app: AppHandle, id: String) -> Result<Vec<system::ProcessInfo>, String> {
    blocking(app, move |_, state| {
        state.require(&id, "process")?;
        Ok(system::processes(&mut state.sys.lock().expect("système")))
    })
    .await
}

#[tauri::command]
async fn ext_ports(app: AppHandle, id: String) -> Result<Vec<system::PortInfo>, String> {
    blocking(app, move |_, state| {
        state.require(&id, "process")?;
        system::ports(&mut state.sys.lock().expect("système"))
    })
    .await
}

#[tauri::command]
async fn ext_kill(app: AppHandle, id: String, pid: u32) -> Result<bool, String> {
    blocking(app, move |app, state| {
        state.require(&id, "process")?;
        let name = system::process_name(&mut state.sys.lock().expect("système"), pid).ok_or("processus introuvable")?;
        let locale = state.locale();
        let ext = state.ext_name(&id, &locale);
        let (title, message, ok) = if locale == "en" {
            ("Stop a process", format!("« {ext} » wants to stop {name} (PID {pid}).\n\nUnsaved data in this program will be lost."), "Stop")
        } else {
            ("Arrêter un processus", format!("« {ext} » veut arrêter {name} (PID {pid}).\n\nLes données non enregistrées de ce programme seront perdues."), "Arrêter")
        };
        if !confirm(app, title, &message, ok, &locale) {
            return Ok(false);
        }
        system::kill(&mut state.sys.lock().expect("système"), pid)?;
        Ok(true)
    })
    .await
}

#[tauri::command]
async fn ext_net_fetch(
    app: AppHandle,
    id: String,
    url: String,
    method: Option<String>,
    headers: Option<BTreeMap<String, String>>,
    body: Option<String>,
) -> Result<net::FetchResult, String> {
    blocking(app, move |_, state| {
        let hosts = state.hosts(&id)?;
        net::fetch(&url, method.as_deref().unwrap_or("GET"), &headers.unwrap_or_default(), body, &hosts)
    })
    .await
}

#[tauri::command]
async fn ext_net_lookup(app: AppHandle, id: String, host: String) -> Result<net::Lookup, String> {
    blocking(app, move |_, state| net::lookup(&host, &state.hosts(&id)?)).await
}

#[tauri::command]
async fn ext_net_tcp(
    app: AppHandle,
    id: String,
    host: String,
    port: u16,
    timeout: Option<u64>,
) -> Result<net::TcpCheck, String> {
    blocking(app, move |_, state| net::tcp(&host, port, timeout.unwrap_or(2000), &state.hosts(&id)?)).await
}

#[tauri::command]
async fn ext_net_ping(app: AppHandle, id: String, host: String, count: Option<u32>) -> Result<net::Ping, String> {
    blocking(app, move |_, state| net::ping(&host, count.unwrap_or(4), &state.hosts(&id)?)).await
}

#[tauri::command]
async fn ext_net_interfaces(app: AppHandle, id: String) -> Result<Vec<system::NetInterface>, String> {
    blocking(app, move |_, state| {
        state.hosts(&id)?;
        Ok(system::interfaces())
    })
    .await
}

#[tauri::command]
fn ext_flush_dns(state: State<AppState>, id: String) -> Result<bool, String> {
    state.require(&id, "shell.safe")?;
    net::flush_dns().map(|_| true)
}

#[tauri::command]
async fn ext_clean_scan(app: AppHandle, id: String) -> Result<Value, String> {
    blocking(app, move |_, state| {
        state.require(&id, "files.scoped")?;
        let roots = cleaner::Roots::from_env().ok_or("profil utilisateur introuvable")?;
        serde_json::to_value(cleaner::scan(&roots, &state.locale())).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
async fn ext_clean_run(app: AppHandle, id: String, targets: Vec<String>) -> Result<Option<cleaner::Cleaned>, String> {
    blocking(app, move |app, state| {
        state.require(&id, "files.scoped")?;
        let targets: Vec<String> = targets.into_iter().filter(|t| cleaner::is_known(t)).collect();
        if targets.is_empty() {
            return Ok(None);
        }
        let locale = state.locale();
        let labels: Vec<&str> = cleaner::TARGETS
            .iter()
            .filter(|t| targets.iter().any(|x| x == t.id))
            .map(|t| cleaner::label(t, &locale))
            .collect();
        let ext = state.ext_name(&id, &locale);
        let list = labels.iter().map(|l| format!("• {l}")).collect::<Vec<_>>().join("\n");
        let (title, message, ok) = if locale == "en" {
            ("Clean up", format!("« {ext} » will permanently delete:\n\n{list}\n\nFiles in use are skipped."), "Delete")
        } else {
            ("Nettoyer", format!("« {ext} » va supprimer définitivement :\n\n{list}\n\nLes fichiers en cours d'utilisation sont ignorés."), "Supprimer")
        };
        if !confirm(app, title, &message, ok, &locale) {
            return Ok(None);
        }
        let roots = cleaner::Roots::from_env().ok_or("profil utilisateur introuvable")?;
        Ok(Some(cleaner::clean(&targets, &roots)))
    })
    .await
}

// ---------- Thèmes ----------

#[tauri::command]
fn list_themes(state: State<AppState>) -> ThemeList {
    let (themes, warnings) = theme::list(&state.paths.themes);
    ThemeList { themes, warnings }
}

#[tauri::command]
async fn import_theme(app: AppHandle, state: State<'_, AppState>) -> Result<Option<theme::ThemeDef>, String> {
    let Some(picked) = app.dialog().file().add_filter("Thème Outilo", &["toml"]).blocking_pick_file() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    let source = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let def = theme::parse(&source, false)?;
    if theme::BUILTIN.iter().any(|b| theme::parse(b, true).is_ok_and(|t| t.id == def.id)) {
        return Err(format!("« {} » est le nom d'un thème intégré", def.id));
    }
    fsutil::write_atomic(&state.paths.themes.join(format!("{}.toml", def.id)), source.as_bytes())?;
    Ok(Some(def))
}

#[tauri::command]
async fn export_theme(app: AppHandle, name: String, content: String) -> Result<bool, String> {
    theme::parse(&content, false)?;
    save_with_dialog(&app, &name, content.as_bytes())
}

#[tauri::command]
fn delete_theme(state: State<AppState>, id: String) -> Result<(), String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err("identifiant invalide".into());
    }
    let _ = fs::remove_file(state.paths.themes.join(format!("{id}.toml")));
    Ok(())
}

// ---------- Fenêtre, zone de notification, raccourci global ----------

const TRAY_ID: &str = "outilo";

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn toggle_main(app: &AppHandle) {
    match app.get_webview_window("main") {
        Some(w) if w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false) => {
            let _ = w.hide();
        }
        _ => show_main(app),
    }
}

fn set_tray(app: &AppHandle, enabled: bool, locale: &str) -> tauri::Result<()> {
    if !enabled {
        app.remove_tray_by_id(TRAY_ID);
        return Ok(());
    }
    if app.tray_by_id(TRAY_ID).is_some() {
        return Ok(());
    }
    let (show, quit) = if locale == "en" { ("Show Outilo", "Quit") } else { ("Afficher Outilo", "Quitter") };
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "show", show, true, None::<&str>)?,
            &MenuItem::with_id(app, "quit", quit, true, None::<&str>)?,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Outilo")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[tauri::command]
fn set_shell_options(app: AppHandle, state: State<AppState>, options: ShellOptions) -> Result<(), String> {
    set_tray(&app, options.close_to_tray, &options.locale).map_err(|e| e.to_string())?;
    let shortcuts = app.global_shortcut();
    let _ = shortcuts.unregister_all();
    let result = match options.shortcut.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => shortcuts.register(s).map_err(|e| format!("raccourci « {s} » indisponible : {e}")),
        None => Ok(()),
    };
    *state.shell.lock().expect("options") = options;
    result
}

fn load_registry(paths: &Paths, state: &ExtState) -> Registry {
    // Dossiers liés par le serveur MCP des développeurs : pris en compte seulement en mode développeur
    let mut state = state.clone();
    if dev_mode(paths) {
        for dir in dev_links(paths) {
            if !state.dev.contains(&dir) {
                state.dev.push(dir);
            }
        }
    }
    let mut reg = match &paths.live {
        Some(repo) => Registry::load_live(repo, &state),
        None => Registry::load(&paths.extensions, paths.bundled.as_deref(), &state),
    };
    reg.load_local(&paths.local, &state);
    reg
}

fn dev_mode(paths: &Paths) -> bool {
    fs::read_to_string(paths.settings())
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v.get("devMode").and_then(Value::as_bool))
        .unwrap_or(false)
}

/// `<root>/dev-links.json` : `{ "folders": ["D:/mes-extensions/slugify"] }`, écrit par `outilo-mcp`.
fn dev_links(paths: &Paths) -> Vec<PathBuf> {
    fs::read_to_string(paths.dev_links())
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v.get("folders").and_then(Value::as_array).cloned())
        .unwrap_or_default()
        .iter()
        .filter_map(|f| f.as_str().map(PathBuf::from))
        .collect()
}

fn unlink_dev(paths: &Paths, dir: &std::path::Path) {
    let folders: Vec<PathBuf> = dev_links(paths).into_iter().filter(|d| d != dir).collect();
    let json = serde_json::json!({ "folders": folders });
    let _ = fsutil::write_atomic(&paths.dev_links(), json.to_string().as_bytes());
}

/// Empreinte des extensions en développement (date de modification la plus récente, nombre de fichiers) :
/// le shell la compare régulièrement pour recharger à chaud.
#[tauri::command]
fn dev_fingerprint(state: State<AppState>) -> BTreeMap<String, String> {
    fn walk(dir: &std::path::Path, out: &mut (u128, usize)) {
        for entry in fs::read_dir(dir).into_iter().flatten().flatten() {
            if out.1 > 5000 {
                return;
            }
            let Ok(meta) = entry.metadata() else { continue };
            if meta.is_dir() {
                walk(&entry.path(), out);
            } else {
                out.1 += 1;
                let t = meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok());
                out.0 = out.0.max(t.map(|d| d.as_millis()).unwrap_or(0));
            }
        }
    }
    let mut map = BTreeMap::new();
    let links = fs::metadata(state.paths.dev_links()).and_then(|m| m.modified()).ok();
    map.insert("__links".into(), format!("{links:?}"));
    let reg = state.registry.lock().expect("registre");
    for (id, ext) in reg.items.iter().filter(|(_, e)| e.source == Source::Dev) {
        let mut fp = (0, 0);
        walk(&ext.dir, &mut fp);
        map.insert(id.clone(), format!("{}:{}", fp.0, fp.1));
    }
    map
}

/// (pack embarqué, dossier du dépôt en développement). `OUTILO_NO_LIVE=1` force le mode installé, pour tester
/// les mises à jour en ligne depuis `npm run app`.
fn extension_sources(app: &AppHandle) -> (Option<PathBuf>, Option<PathBuf>) {
    let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("extensions");
    let bundled = app.path().resource_dir().ok().map(|d| d.join("extensions")).filter(|d| d.is_dir());
    if cfg!(debug_assertions) && repo.is_dir() {
        if std::env::var_os("OUTILO_NO_LIVE").is_some() {
            return (bundled.or(Some(repo)), None);
        }
        return (None, Some(repo));
    }
    (bundled, None)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Un second lancement ramène la fenêtre existante au premier plan
        .plugin(tauri_plugin_single_instance::init(|app, _, _| show_main(app)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_main(app);
                    }
                })
                .build(),
        )
        .register_uri_scheme_protocol(protocol::SCHEME, protocol::handle)
        .setup(|app| {
            let root = app.path().data_dir()?.join("Outilo");
            let (bundled, live) = extension_sources(app.handle());
            let paths = Paths {
                extensions: root.join("extensions"),
                data: root.join("data"),
                themes: root.join("themes"),
                local: root.join("local"),
                bundled,
                live,
                root,
            };
            for dir in [&paths.extensions, &paths.data, &paths.themes, &paths.local] {
                fs::create_dir_all(dir)?;
            }
            updater::cleanup(&paths.updates());
            let ext_state = ExtState::load(&paths.ext_state());
            let registry = load_registry(&paths, &ext_state);
            app.manage(AppState {
                paths,
                registry: Mutex::new(registry),
                ext_state: Mutex::new(ext_state),
                sys: Mutex::new(sysinfo::System::new()),
                index: Mutex::new(None),
                shell: Mutex::new(ShellOptions::default()),
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                if state.shell.lock().expect("options").close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            get_settings,
            save_settings,
            list_extensions,
            reload_extensions,
            set_extension_enabled,
            uninstall_extension,
            restore_official_extensions,
            list_bundled,
            install_local,
            choose_extensions,
            install_bundled,
            add_dev_extension,
            registry_check,
            registry_install,
            registry_rollback,
            app_update_check,
            app_update_install,
            ext_storage,
            ext_sql,
            ext_save_file,
            ext_system_info,
            ext_processes,
            ext_ports,
            ext_kill,
            ext_net_fetch,
            ext_net_lookup,
            ext_net_tcp,
            ext_net_ping,
            ext_net_interfaces,
            ext_flush_dns,
            ext_clean_scan,
            ext_clean_run,
            list_themes,
            import_theme,
            export_theme,
            delete_theme,
            set_shell_options,
            dev_fingerprint,
        ])
        .run(tauri::generate_context!())
        .expect("erreur au lancement d'Outilo");
}
