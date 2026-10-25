//! Réseau pour les extensions (permission `network`, limitée aux domaines déclarés dans le manifeste)
//! et vidage du cache DNS (permission `shell.safe`).

use serde::Serialize;
use std::collections::BTreeMap;
use std::net::{IpAddr, SocketAddr, TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};

const MAX_BODY: u64 = 5 * 1024 * 1024;

/// `host` est-il couvert par l'un des motifs (`exemple.com`, `*.exemple.com`, `*`) ?
pub fn host_allowed(host: &str, patterns: &[String]) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    patterns.iter().any(|p| match p.strip_prefix("*.") {
        _ if p == "*" => true,
        Some(domain) => host.ends_with(&format!(".{domain}")),
        None => host == *p,
    })
}

fn check_host(host: &str, patterns: &[String]) -> Result<(), String> {
    if host.is_empty() || host.len() > 253 || host.contains(['/', '\\', ' ', '@']) {
        return Err(format!("hôte invalide : {host}"));
    }
    if host_allowed(host, patterns) {
        Ok(())
    } else {
        Err(format!("domaine non déclaré dans le manifeste : {host}"))
    }
}

#[derive(Debug, Serialize)]
pub struct FetchResult {
    status: u16,
    headers: BTreeMap<String, String>,
    body: String,
    ms: u128,
}

pub fn fetch(
    url: &str,
    method: &str,
    headers: &BTreeMap<String, String>,
    body: Option<String>,
    patterns: &[String],
) -> Result<FetchResult, String> {
    let uri: ureq::http::Uri = url.parse().map_err(|_| format!("adresse invalide : {url}"))?;
    if !matches!(uri.scheme_str(), Some("https" | "http")) {
        return Err("seuls http et https sont autorisés".into());
    }
    check_host(uri.host().unwrap_or(""), patterns)?;
    let method: ureq::http::Method = method.to_ascii_uppercase().parse().map_err(|_| "méthode invalide")?;
    let mut builder = ureq::http::Request::builder().method(method).uri(uri);
    for (k, v) in headers {
        builder = builder.header(k, v);
    }
    let request = builder.body(body.unwrap_or_default()).map_err(|e| e.to_string())?;
    // Une redirection pourrait mener hors des domaines déclarés : elles ne sont suivies qu'avec « * »
    let redirects = if patterns.iter().any(|p| p == "*") { 5 } else { 0 };
    let agent: ureq::Agent = ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(20)))
        .http_status_as_error(false)
        .max_redirects(redirects)
        .user_agent(concat!("Outilo/", env!("CARGO_PKG_VERSION")))
        .build()
        .into();
    let start = Instant::now();
    let mut res = agent.run(request).map_err(|e| format!("réseau : {e}"))?;
    let headers = res
        .headers()
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.as_str().to_owned(), v.to_owned())))
        .collect();
    let bytes = res.body_mut().with_config().limit(MAX_BODY).read_to_vec().map_err(|e| format!("réseau : {e}"))?;
    Ok(FetchResult {
        status: res.status().as_u16(),
        headers,
        body: String::from_utf8_lossy(&bytes).into_owned(),
        ms: start.elapsed().as_millis(),
    })
}

#[derive(Debug, Serialize)]
pub struct Lookup {
    addresses: Vec<String>,
    ms: u128,
}

pub fn lookup(host: &str, patterns: &[String]) -> Result<Lookup, String> {
    check_host(host, patterns)?;
    let start = Instant::now();
    let mut addresses: Vec<String> = (host, 0)
        .to_socket_addrs()
        .map_err(|e| format!("résolution impossible : {e}"))?
        .map(|a| a.ip().to_string())
        .collect();
    addresses.dedup();
    Ok(Lookup { addresses, ms: start.elapsed().as_millis() })
}

fn resolve(host: &str, port: u16) -> Result<SocketAddr, String> {
    (host, port)
        .to_socket_addrs()
        .map_err(|e| format!("résolution impossible : {e}"))?
        .next()
        .ok_or("aucune adresse".into())
}

#[derive(Debug, Serialize)]
pub struct TcpCheck {
    open: bool,
    address: String,
    ms: u128,
    error: Option<String>,
}

pub fn tcp(host: &str, port: u16, timeout_ms: u64, patterns: &[String]) -> Result<TcpCheck, String> {
    check_host(host, patterns)?;
    let addr = resolve(host, port)?;
    let start = Instant::now();
    let result = TcpStream::connect_timeout(&addr, Duration::from_millis(timeout_ms.clamp(100, 10_000)));
    Ok(TcpCheck {
        open: result.is_ok(),
        address: addr.to_string(),
        ms: start.elapsed().as_millis(),
        error: result.err().map(|e| e.to_string()),
    })
}

#[derive(Debug, Serialize)]
pub struct PingReply {
    ok: bool,
    ms: Option<u32>,
    status: u32,
}

#[derive(Debug, Serialize)]
pub struct Ping {
    address: String,
    replies: Vec<PingReply>,
}

/// Ping ICMP via l'API Windows (aucun droit administrateur requis), IPv4.
#[cfg(windows)]
pub fn ping(host: &str, count: u32, patterns: &[String]) -> Result<Ping, String> {
    use windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE;
    use windows_sys::Win32::NetworkManagement::IpHelper::{
        IcmpCloseHandle, IcmpCreateFile, IcmpSendEcho, ICMP_ECHO_REPLY,
    };
    check_host(host, patterns)?;
    let ip = (host, 0)
        .to_socket_addrs()
        .map_err(|e| format!("résolution impossible : {e}"))?
        .find_map(|a| match a.ip() {
            IpAddr::V4(v4) => Some(v4),
            IpAddr::V6(_) => None,
        })
        .ok_or("aucune adresse IPv4")?;
    // SAFETY : handle vérifié puis fermé ; tampon de réponse dimensionné selon la documentation d'IcmpSendEcho.
    unsafe {
        let handle = IcmpCreateFile();
        if handle == INVALID_HANDLE_VALUE {
            return Err("ICMP indisponible".into());
        }
        let data = *b"outilo-ping-0123456789abcdef0123";
        let mut buf = vec![0u8; std::mem::size_of::<ICMP_ECHO_REPLY>() + data.len() + 8];
        let mut replies = Vec::new();
        for i in 0..count.clamp(1, 10) {
            if i > 0 {
                std::thread::sleep(Duration::from_millis(500));
            }
            let n = IcmpSendEcho(
                handle,
                u32::from_ne_bytes(ip.octets()),
                data.as_ptr().cast(),
                data.len() as u16,
                std::ptr::null(),
                buf.as_mut_ptr().cast(),
                buf.len() as u32,
                2000,
            );
            let reply = std::ptr::read_unaligned(buf.as_ptr().cast::<ICMP_ECHO_REPLY>());
            let ok = n > 0 && reply.Status == 0;
            replies.push(PingReply { ok, ms: ok.then_some(reply.RoundTripTime), status: reply.Status });
        }
        IcmpCloseHandle(handle);
        Ok(Ping { address: ip.to_string(), replies })
    }
}

#[cfg(not(windows))]
pub fn ping(_host: &str, _count: u32, _patterns: &[String]) -> Result<Ping, String> {
    Err("ping disponible sous Windows uniquement".into())
}

#[cfg(windows)]
#[link(name = "dnsapi")]
extern "system" {
    fn DnsFlushResolverCache() -> i32;
}

/// Équivalent de `ipconfig /flushdns`, sans lancer de processus.
#[cfg(windows)]
pub fn flush_dns() -> Result<(), String> {
    // SAFETY : fonction sans paramètre de dnsapi.dll.
    if unsafe { DnsFlushResolverCache() } != 0 {
        Ok(())
    } else {
        Err("le système a refusé de vider le cache DNS".into())
    }
}

#[cfg(not(windows))]
pub fn flush_dns() -> Result<(), String> {
    Err("disponible sous Windows uniquement".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_patterns() {
        let p = vec!["api.ipify.org".to_owned(), "*.exemple.org".to_owned()];
        assert!(host_allowed("api.ipify.org", &p));
        assert!(host_allowed("API.ipify.org.", &p));
        assert!(host_allowed("a.b.exemple.org", &p));
        assert!(!host_allowed("exemple.org", &p));
        assert!(!host_allowed("evil-api.ipify.org", &p));
        assert!(!host_allowed("api.ipify.org.evil.com", &p));
        assert!(host_allowed("n-importe-quoi.fr", &["*".to_owned()]));
    }

    #[test]
    fn fetch_refuses_undeclared_hosts_and_schemes() {
        let p = vec!["api.ipify.org".to_owned()];
        let none = BTreeMap::new();
        assert!(fetch("https://evil.com/x", "GET", &none, None, &p).unwrap_err().contains("non déclaré"));
        assert!(fetch("file:///C:/Windows/win.ini", "GET", &none, None, &p).is_err());
        assert!(lookup("evil.com", &p).is_err());
        assert!(tcp("evil.com", 80, 500, &p).is_err());
    }
}

#[cfg(test)]
mod local_tests {
    use super::*;

    #[test]
    fn local_diagnostics() {
        let all = vec!["*".to_owned()];
        assert!(!lookup("localhost", &all).unwrap().addresses.is_empty());
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(tcp("127.0.0.1", port, 1000, &all).unwrap().open);
        drop(listener);
        assert!(!tcp("127.0.0.1", port, 500, &all).unwrap().open);
        let ping = ping("127.0.0.1", 2, &all).unwrap();
        assert!(ping.replies.iter().all(|r| r.ok), "{ping:?}");
    }
}
