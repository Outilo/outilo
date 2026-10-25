//! Informations système, processus et ports (permissions `system.info` et `process`).

use serde::Serialize;
use std::collections::HashMap;
use sysinfo::{Disks, Networks, Pid, ProcessesToUpdate, System};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    os: String,
    os_version: String,
    kernel: String,
    hostname: String,
    arch: String,
    uptime: u64,
    cpu: String,
    cores: Option<usize>,
    threads: usize,
    frequency_mhz: u64,
    cpu_usage: f32,
    memory_total: u64,
    memory_used: u64,
    swap_total: u64,
    swap_used: u64,
    gpus: Vec<String>,
    disks: Vec<DiskInfo>,
    networks: Vec<NetInterface>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    name: String,
    mount: String,
    file_system: String,
    kind: String,
    total: u64,
    available: u64,
    removable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetInterface {
    name: String,
    mac: String,
    addresses: Vec<String>,
    received: u64,
    transmitted: u64,
}

pub fn info(sys: &mut System) -> SystemInfo {
    sys.refresh_memory();
    sys.refresh_cpu_all();
    let cpus = sys.cpus();
    SystemInfo {
        os: System::long_os_version().or_else(System::name).unwrap_or_default(),
        os_version: System::os_version().unwrap_or_default(),
        kernel: System::kernel_version().unwrap_or_default(),
        hostname: System::host_name().unwrap_or_default(),
        arch: System::cpu_arch(),
        uptime: System::uptime(),
        cpu: cpus.first().map(|c| c.brand().trim().to_owned()).unwrap_or_default(),
        cores: System::physical_core_count(),
        threads: cpus.len(),
        frequency_mhz: cpus.first().map(|c| c.frequency()).unwrap_or(0),
        cpu_usage: sys.global_cpu_usage(),
        memory_total: sys.total_memory(),
        memory_used: sys.used_memory(),
        swap_total: sys.total_swap(),
        swap_used: sys.used_swap(),
        gpus: gpus(),
        disks: Disks::new_with_refreshed_list()
            .list()
            .iter()
            .map(|d| DiskInfo {
                name: d.name().to_string_lossy().into_owned(),
                mount: d.mount_point().display().to_string(),
                file_system: d.file_system().to_string_lossy().into_owned(),
                kind: d.kind().to_string(),
                total: d.total_space(),
                available: d.available_space(),
                removable: d.is_removable(),
            })
            .collect(),
        networks: interfaces(),
    }
}

pub fn interfaces() -> Vec<NetInterface> {
    let mut list: Vec<NetInterface> = Networks::new_with_refreshed_list()
        .list()
        .iter()
        .filter(|(_, n)| !n.ip_networks().is_empty())
        .map(|(name, n)| NetInterface {
            name: name.clone(),
            mac: n.mac_address().to_string(),
            addresses: n.ip_networks().iter().map(|ip| format!("{}/{}", ip.addr, ip.prefix)).collect(),
            received: n.total_received(),
            transmitted: n.total_transmitted(),
        })
        .collect();
    list.sort_by(|a, b| a.name.cmp(&b.name));
    list
}

/// Cartes graphiques, lues dans le registre (lecture seule, sans droits administrateur).
#[cfg(windows)]
fn gpus() -> Vec<String> {
    use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ};
    const CLASS: &str = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}";
    let wide = |s: &str| s.encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
    let value = wide("DriverDesc");
    let mut out = Vec::new();
    for i in 0..16 {
        let key = wide(&format!(r"{CLASS}\{i:04}"));
        let mut buf = [0u16; 256];
        let mut len = (buf.len() * 2) as u32;
        // SAFETY : tampons valides et terminés par zéro ; la taille est passée en octets.
        let status = unsafe {
            RegGetValueW(
                HKEY_LOCAL_MACHINE,
                key.as_ptr(),
                value.as_ptr(),
                RRF_RT_REG_SZ,
                std::ptr::null_mut(),
                buf.as_mut_ptr().cast(),
                &mut len,
            )
        };
        if status != 0 {
            continue;
        }
        let chars = (len as usize / 2).saturating_sub(1);
        let name = String::from_utf16_lossy(&buf[..chars]);
        if !name.is_empty() && !out.contains(&name) {
            out.push(name);
        }
    }
    out
}

#[cfg(not(windows))]
fn gpus() -> Vec<String> {
    Vec::new()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pid: u32,
    parent: Option<u32>,
    name: String,
    exe: String,
    memory: u64,
    cpu: f32,
    start_time: u64,
}

pub fn processes(sys: &mut System) -> Vec<ProcessInfo> {
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let mut list: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32(),
            parent: p.parent().map(|p| p.as_u32()),
            name: p.name().to_string_lossy().into_owned(),
            exe: p.exe().map(|e| e.display().to_string()).unwrap_or_default(),
            memory: p.memory(),
            cpu: p.cpu_usage(),
            start_time: p.start_time(),
        })
        .collect();
    list.sort_by(|a, b| b.memory.cmp(&a.memory));
    list
}

pub fn process_name(sys: &mut System, pid: u32) -> Option<String> {
    sys.refresh_processes(ProcessesToUpdate::Some(&[Pid::from_u32(pid)]), true);
    sys.process(Pid::from_u32(pid)).map(|p| p.name().to_string_lossy().into_owned())
}

/// Arrête un processus de l'utilisateur. Les processus système et Outilo lui-même sont refusés.
pub fn kill(sys: &mut System, pid: u32) -> Result<(), String> {
    if pid <= 4 || pid == std::process::id() {
        return Err("ce processus ne peut pas être arrêté".into());
    }
    let process = sys.process(Pid::from_u32(pid)).ok_or("processus introuvable")?;
    if process.kill() {
        Ok(())
    } else {
        Err("arrêt refusé par le système (processus d'un autre utilisateur ou protégé)".into())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    protocol: &'static str,
    local_addr: String,
    local_port: u16,
    remote_addr: String,
    remote_port: u16,
    state: String,
    pid: Option<u32>,
    process: String,
}

pub fn ports(sys: &mut System) -> Result<Vec<PortInfo>, String> {
    use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let names: HashMap<u32, String> =
        sys.processes().values().map(|p| (p.pid().as_u32(), p.name().to_string_lossy().into_owned())).collect();
    let sockets =
        get_sockets_info(AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6, ProtocolFlags::TCP | ProtocolFlags::UDP)
            .map_err(|e| e.to_string())?;
    let mut list: Vec<PortInfo> = sockets
        .into_iter()
        .map(|s| {
            let pid = s.associated_pids.first().copied();
            let process = pid.and_then(|p| names.get(&p).cloned()).unwrap_or_default();
            match s.protocol_socket_info {
                ProtocolSocketInfo::Tcp(t) => PortInfo {
                    protocol: "TCP",
                    local_addr: t.local_addr.to_string(),
                    local_port: t.local_port,
                    remote_addr: t.remote_addr.to_string(),
                    remote_port: t.remote_port,
                    state: t.state.to_string(),
                    pid,
                    process,
                },
                ProtocolSocketInfo::Udp(u) => PortInfo {
                    protocol: "UDP",
                    local_addr: u.local_addr.to_string(),
                    local_port: u.local_port,
                    remote_addr: String::new(),
                    remote_port: 0,
                    state: String::new(),
                    pid,
                    process,
                },
            }
        })
        .collect();
    list.sort_by(|a, b| a.local_port.cmp(&b.local_port).then(a.protocol.cmp(b.protocol)));
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_this_machine() {
        let mut sys = System::new();
        let info = info(&mut sys);
        assert!(info.threads > 0 && info.memory_total > 0 && !info.disks.is_empty());
        let procs = processes(&mut sys);
        assert!(procs.iter().any(|p| p.pid == std::process::id()));
        assert!(ports(&mut sys).is_ok());
        assert!(kill(&mut sys, std::process::id()).is_err(), "Outilo ne s'arrête pas lui-même");
        assert!(kill(&mut sys, 4).is_err());
    }
}
