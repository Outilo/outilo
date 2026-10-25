//! Protocole `outilo-ext://` : sert les fichiers des extensions et le SDK dans une origine séparée du shell.
//!
//! Sous Windows, WebView2 l'expose en `http://outilo-ext.localhost/<id>/<chemin>`.

use crate::AppState;
use std::borrow::Cow;
use tauri::http::{header, Request, Response, StatusCode};
use tauri::{Manager, Runtime, UriSchemeContext};

pub const SCHEME: &str = "outilo-ext";

#[cfg(windows)]
pub const BASE_URL: &str = "http://outilo-ext.localhost/";
#[cfg(not(windows))]
pub const BASE_URL: &str = "outilo-ext://localhost/";

const SDK: &[(&str, &[u8])] = &[
    ("outilo-sdk.js", include_bytes!("../../sdk/outilo-sdk.js")),
    ("outilo-ui.css", include_bytes!("../../sdk/outilo-ui.css")),
    ("fonts/inter.woff2", include_bytes!("../../sdk/fonts/inter.woff2")),
    ("fonts/jetbrains-mono-400.woff2", include_bytes!("../../sdk/fonts/jetbrains-mono-400.woff2")),
    ("fonts/jetbrains-mono-500.woff2", include_bytes!("../../sdk/fonts/jetbrains-mono-500.woff2")),
];

/// Les extensions n'ont aucun accès réseau ni cadre imbriqué ; tout passe par l'API du shell.
const CSP: &str = "default-src 'none'; \
    script-src http://outilo-ext.localhost outilo-ext: 'unsafe-inline'; \
    style-src http://outilo-ext.localhost outilo-ext: 'unsafe-inline'; \
    img-src http://outilo-ext.localhost outilo-ext: data: blob:; \
    font-src http://outilo-ext.localhost outilo-ext: data:; \
    connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

pub fn handle<R: Runtime>(ctx: UriSchemeContext<'_, R>, request: Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    let path = percent_decode(request.uri().path());
    let path = path.trim_start_matches('/');
    let (first, rest) = path.split_once('/').unwrap_or((path, ""));

    if first == "_sdk" {
        return match SDK.iter().find(|(name, _)| *name == rest) {
            Some((name, bytes)) => respond(StatusCode::OK, mime(name), Cow::Borrowed(*bytes)),
            None => not_found(),
        };
    }

    let state = ctx.app_handle().state::<AppState>();
    let dir = {
        let reg = state.registry.lock().expect("registre");
        let disabled = state.ext_state.lock().expect("état").disabled.contains(&first.to_owned());
        match reg.get(first) {
            Some(ext) if !disabled => ext.dir.clone(),
            _ => return not_found(),
        }
    };
    match crate::fsutil::resolve_inside(&dir, rest).and_then(|p| std::fs::read(&p).ok().map(|b| (p, b))) {
        Some((file, bytes)) => respond(StatusCode::OK, mime(&file.to_string_lossy()), Cow::Owned(bytes)),
        None => not_found(),
    }
}

fn respond(status: StatusCode, content_type: &str, body: Cow<'static, [u8]>) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        // Les cadres d'extension ont une origine opaque (sandbox) : nécessaire pour les modules ES et les polices
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CACHE_CONTROL, "no-store")
        .header("Content-Security-Policy", CSP)
        .header("X-Content-Type-Options", "nosniff")
        .body(body)
        .expect("réponse valide")
}

fn not_found() -> Response<Cow<'static, [u8]>> {
    respond(StatusCode::NOT_FOUND, "text/plain; charset=utf-8", Cow::Borrowed(b"introuvable"))
}

fn mime(name: &str) -> &'static str {
    match name.rsplit('.').next().unwrap_or("").to_ascii_lowercase().as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "wasm" => "application/wasm",
        "txt" | "md" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok();
            if let Some(b) = hex.and_then(|h| u8::from_str_radix(h, 16).ok()) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_percent_sequences() {
        assert_eq!(percent_decode("/a%20b/c%C3%A9.html"), "/a b/cé.html");
        assert_eq!(percent_decode("/bad%zz"), "/bad%zz");
        assert_eq!(percent_decode("/end%2"), "/end%2");
    }

    #[test]
    fn mime_types() {
        assert_eq!(mime("ui/index.html"), "text/html; charset=utf-8");
        assert_eq!(mime("x.WASM"), "application/wasm");
    }
}
