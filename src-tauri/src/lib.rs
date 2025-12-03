use hyper_util::rt::tokio::TokioIo;
use tonic::transport::{Endpoint, Uri};
use tower::service_fn;
use std::path::PathBuf;
use std::process::{Command, Child};
use std::sync::Mutex;
use once_cell::sync::Lazy;

// Global state to track the ConnectToolCore process
static CORE_PROCESS: Lazy<Mutex<Option<Child>>> = Lazy::new(|| Mutex::new(None));

pub mod connecttool {
    tonic::include_proto!("connecttool");
}

use connecttool::connect_tool_service_client::ConnectToolServiceClient;
use connecttool::*;

#[cfg(windows)]
use tokio_util::compat::FuturesAsyncReadCompatExt;

// ============== Steam Path Finding ==============

/// Response structure for find_steam_path command
#[derive(serde::Serialize)]
pub struct FindSteamPathResponse {
    pub found: bool,
    pub steam_path: Option<String>,
    pub steam_exe_path: Option<String>,
    pub message: String,
}

/// Response structure for restart_steam_china command
#[derive(serde::Serialize)]
pub struct RestartSteamChinaResponse {
    pub success: bool,
    pub message: String,
}

/// Response structure for get_steam_status command
#[derive(serde::Serialize)]
pub struct GetSteamStatusResponse {
    pub is_running: bool,
    pub process_id: Option<u32>,
}

/// Find Steam installation path on Windows
#[cfg(windows)]
fn find_steam_path_windows() -> Option<PathBuf> {
    use winreg::enums::*;
    use winreg::RegKey;

    // Try HKEY_CURRENT_USER first
    if let Ok(hkcu) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Software\\Valve\\Steam") {
        if let Ok(path) = hkcu.get_value::<String, _>("SteamPath") {
            let steam_path = PathBuf::from(&path);
            if steam_path.exists() {
                return Some(steam_path);
            }
        }
    }

    // Try HKEY_LOCAL_MACHINE (32-bit)
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey("SOFTWARE\\Valve\\Steam") {
        if let Ok(path) = hklm.get_value::<String, _>("InstallPath") {
            let steam_path = PathBuf::from(&path);
            if steam_path.exists() {
                return Some(steam_path);
            }
        }
    }

    // Try HKEY_LOCAL_MACHINE (64-bit - WOW6432Node)
    if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey("SOFTWARE\\WOW6432Node\\Valve\\Steam") {
        if let Ok(path) = hklm.get_value::<String, _>("InstallPath") {
            let steam_path = PathBuf::from(&path);
            if steam_path.exists() {
                return Some(steam_path);
            }
        }
    }

    // Fallback: check default locations
    let default_paths = vec![
        "C:\\Program Files (x86)\\Steam",
        "C:\\Program Files\\Steam",
        "D:\\Steam",
        "D:\\Program Files (x86)\\Steam",
    ];

    for path in default_paths {
        let steam_path = PathBuf::from(path);
        if steam_path.exists() && steam_path.join("steam.exe").exists() {
            return Some(steam_path);
        }
    }

    None
}

/// Find Steam installation path on macOS
#[cfg(target_os = "macos")]
fn find_steam_path_macos() -> Option<PathBuf> {
    // Try mdfind first
    if let Ok(output) = Command::new("mdfind")
        .args(&["kMDItemCFBundleIdentifier", "=", "com.valvesoftware.steam"])
        .output()
    {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout);
            for line in path_str.lines() {
                let steam_path = PathBuf::from(line.trim());
                if steam_path.exists() {
                    return Some(steam_path);
                }
            }
        }
    }

    // Check default location
    let default_path = PathBuf::from("/Applications/Steam.app");
    if default_path.exists() {
        return Some(default_path);
    }

    // Check user's home directory
    if let Ok(home) = std::env::var("HOME") {
        let user_path = PathBuf::from(home).join("Applications/Steam.app");
        if user_path.exists() {
            return Some(user_path);
        }
    }

    None
}

/// Find Steam installation path on Linux
#[cfg(target_os = "linux")]
fn find_steam_path_linux() -> Option<PathBuf> {
    // Try which steam
    if let Ok(output) = Command::new("which").arg("steam").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout);
            let steam_path = PathBuf::from(path_str.trim());
            if steam_path.exists() {
                // Get the actual Steam installation directory
                if let Ok(real_path) = std::fs::read_link(&steam_path) {
                    if let Some(parent) = real_path.parent() {
                        return Some(parent.to_path_buf());
                    }
                }
                return Some(steam_path);
            }
        }
    }

    // Check common paths
    if let Ok(home) = std::env::var("HOME") {
        let paths = vec![
            PathBuf::from(&home).join(".steam/steam"),
            PathBuf::from(&home).join(".steam"),
            PathBuf::from(&home).join(".local/share/Steam"),
            PathBuf::from("/usr/share/steam"),
            PathBuf::from("/usr/lib/steam"),
        ];

        for path in paths {
            if path.exists() {
                return Some(path);
            }
        }
    }

    None
}

/// Get Steam executable path
fn get_steam_exe_path(steam_path: &PathBuf) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let exe = steam_path.join("steam.exe");
        if exe.exists() {
            return Some(exe);
        }
    }

    #[cfg(target_os = "macos")]
    {
        let exe = steam_path.join("Contents/MacOS/steam_osx");
        if exe.exists() {
            return Some(exe);
        }
        // Alternative path
        let exe2 = steam_path.join("Contents/MacOS/Steam");
        if exe2.exists() {
            return Some(exe2);
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Check if steam_path is the executable itself
        if steam_path.is_file() {
            return Some(steam_path.clone());
        }
        let exe = steam_path.join("steam");
        if exe.exists() {
            return Some(exe);
        }
        let exe2 = steam_path.join("steam.sh");
        if exe2.exists() {
            return Some(exe2);
        }
    }

    None
}

/// Cross-platform Steam path finder
fn find_steam_path() -> Option<PathBuf> {
    #[cfg(windows)]
    return find_steam_path_windows();

    #[cfg(target_os = "macos")]
    return find_steam_path_macos();

    #[cfg(target_os = "linux")]
    return find_steam_path_linux();

    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    return None;
}

/// Check if Steam is running on Windows
#[cfg(windows)]
fn is_steam_running() -> Option<u32> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = Command::new("tasklist")
        .args(&["/FI", "IMAGENAME eq steam.exe", "/FO", "CSV", "/NH"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    
    // Parse CSV output to get PID
    for line in output_str.lines() {
        if line.contains("steam.exe") {
            // Format: "steam.exe","PID","Session Name","Session#","Mem Usage"
            let parts: Vec<&str> = line.split(',').collect();
            if parts.len() >= 2 {
                // Remove quotes and parse PID
                let pid_str = parts[1].trim_matches('"');
                if let Ok(pid) = pid_str.parse::<u32>() {
                    return Some(pid);
                }
            }
        }
    }
    None
}

/// Check if Steam is running on Unix
#[cfg(unix)]
fn is_steam_running() -> Option<u32> {
    let output = Command::new("pgrep")
        .args(&["-x", "steam"])
        .output()
        .ok()?;

    if output.status.success() {
        let output_str = String::from_utf8_lossy(&output.stdout);
        if let Ok(pid) = output_str.trim().lines().next()?.parse::<u32>() {
            return Some(pid);
        }
    }
    None
}

/// Kill Steam process on Windows
#[cfg(windows)]
fn kill_steam_process() -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = Command::new("taskkill")
        .args(&["/IM", "steam.exe", "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute taskkill: {}", e))?;

    if output.status.success() {
        // Wait a bit for Steam to fully close
        std::thread::sleep(std::time::Duration::from_secs(2));
        Ok(())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to kill Steam: {}", error))
    }
}

/// Kill Steam process on Unix
#[cfg(unix)]
fn kill_steam_process() -> Result<(), String> {
    let output = Command::new("pkill")
        .args(&["-x", "steam"])
        .output()
        .map_err(|e| format!("Failed to execute pkill: {}", e))?;

    if output.status.success() || output.status.code() == Some(1) {
        // Wait a bit for Steam to fully close
        std::thread::sleep(std::time::Duration::from_secs(2));
        Ok(())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to kill Steam: {}", error))
    }
}

/// Start Steam with -steamchina argument
fn start_steam_china(steam_exe_path: &PathBuf) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        Command::new(steam_exe_path)
            .arg("-steamchina")
            .creation_flags(DETACHED_PROCESS | CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to start Steam: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(&["-a", steam_exe_path.to_str().unwrap_or("Steam"), "--args", "-steamchina"])
            .spawn()
            .map_err(|e| format!("Failed to start Steam: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new(steam_exe_path)
            .arg("-steamchina")
            .spawn()
            .map_err(|e| format!("Failed to start Steam: {}", e))?;
    }

    Ok(())
}

// ============== End Steam Path Finding ==============

#[cfg(windows)]
struct AsyncWindowsUds(async_io::Async<uds_windows::UnixStream>);

#[cfg(windows)]
impl futures::io::AsyncRead for AsyncWindowsUds {
    fn poll_read(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut [u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        std::pin::Pin::new(&mut &self.0).poll_read(cx, buf)
    }
}

#[cfg(windows)]
impl futures::io::AsyncWrite for AsyncWindowsUds {
    fn poll_write(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        std::pin::Pin::new(&mut &self.0).poll_write(cx, buf)
    }

    fn poll_flush(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        std::pin::Pin::new(&mut &self.0).poll_flush(cx)
    }

    fn poll_close(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        std::pin::Pin::new(&mut &self.0).poll_close(cx)
    }
}

#[cfg(windows)]
async fn connect_uds(
    path: &str,
) -> Result<
    TokioIo<impl tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static>,
    String,
> {
    let stream = uds_windows::UnixStream::connect(path).map_err(|e| e.to_string())?;
    stream.set_nonblocking(true).map_err(|e| e.to_string())?;
    let stream = async_io::Async::new(stream).map_err(|e| e.to_string())?;
    Ok(TokioIo::new(AsyncWindowsUds(stream).compat()))
}

#[cfg(unix)]
async fn connect_uds(path: &str) -> Result<TokioIo<tokio::net::UnixStream>, String> {
    let stream = tokio::net::UnixStream::connect(path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(TokioIo::new(stream))
}

// Helper to get client
async fn get_client() -> Result<ConnectToolServiceClient<tonic::transport::Channel>, String> {
    // Determine socket path
    #[cfg(windows)]
    let socket_path = "connect_tool.sock";
    #[cfg(not(windows))]
    let socket_path = "/tmp/connect_tool.sock";

    // We need to ignore the uri in the connector
    let channel = Endpoint::try_from("http://[::]:50051")
        .map_err(|e| e.to_string())?
        .connect_with_connector(service_fn(move |_: Uri| {
            // Connect to UDS
            connect_uds(socket_path)
        }))
        .await
        .map_err(|e| format!("Failed to connect to UDS at {}: {}", socket_path, e))?;

    Ok(ConnectToolServiceClient::new(channel))
}

#[tauri::command]
async fn create_lobby() -> Result<CreateLobbyResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .create_lobby(CreateLobbyRequest {})
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
}

#[tauri::command]
async fn join_lobby(lobby_id: String) -> Result<JoinLobbyResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .join_lobby(JoinLobbyRequest { lobby_id })
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
}

#[tauri::command]
async fn leave_lobby() -> Result<LeaveLobbyResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .leave_lobby(LeaveLobbyRequest {})
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
}

#[tauri::command]
async fn get_lobby_info() -> Result<GetLobbyInfoResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .get_lobby_info(GetLobbyInfoRequest {})
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
}

#[tauri::command]
async fn get_friend_lobbies() -> Result<GetFriendLobbiesResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .get_friend_lobbies(GetFriendLobbiesRequest {})
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
}

#[tauri::command]
async fn invite_friend(friend_steam_id: String) -> Result<InviteFriendResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .invite_friend(InviteFriendRequest { friend_steam_id })
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
}

#[tauri::command]
async fn get_vpn_status() -> Result<GetVpnStatusResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .get_vpn_status(GetVpnStatusRequest {})
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
}

#[tauri::command]
async fn get_vpn_routing_table() -> Result<GetVpnRoutingTableResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .get_vpn_routing_table(GetVpnRoutingTableRequest {})
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
}

// ============== Steam Management Commands ==============

#[tauri::command]
async fn find_steam() -> Result<FindSteamPathResponse, String> {
    match find_steam_path() {
        Some(steam_path) => {
            let steam_exe = get_steam_exe_path(&steam_path);
            Ok(FindSteamPathResponse {
                found: true,
                steam_path: Some(steam_path.to_string_lossy().to_string()),
                steam_exe_path: steam_exe.map(|p| p.to_string_lossy().to_string()),
                message: "Steam found successfully".to_string(),
            })
        }
        None => Ok(FindSteamPathResponse {
            found: false,
            steam_path: None,
            steam_exe_path: None,
            message: "Steam installation not found".to_string(),
        }),
    }
}

#[tauri::command]
async fn get_steam_running_status() -> Result<GetSteamStatusResponse, String> {
    let pid = is_steam_running();
    Ok(GetSteamStatusResponse {
        is_running: pid.is_some(),
        process_id: pid,
    })
}

#[tauri::command]
async fn restart_steam_china() -> Result<RestartSteamChinaResponse, String> {
    // Find Steam path
    let steam_path = match find_steam_path() {
        Some(path) => path,
        None => {
            return Ok(RestartSteamChinaResponse {
                success: false,
                message: "Steam installation not found".to_string(),
            });
        }
    };

    // Get Steam executable path
    let steam_exe = match get_steam_exe_path(&steam_path) {
        Some(exe) => exe,
        None => {
            return Ok(RestartSteamChinaResponse {
                success: false,
                message: "Steam executable not found".to_string(),
            });
        }
    };

    // Check if Steam is running and kill it
    if is_steam_running().is_some() {
        if let Err(e) = kill_steam_process() {
            return Ok(RestartSteamChinaResponse {
                success: false,
                message: format!("Failed to stop Steam: {}", e),
            });
        }
    }

    // Start Steam with -steamchina
    match start_steam_china(&steam_exe) {
        Ok(()) => Ok(RestartSteamChinaResponse {
            success: true,
            message: "Steam started with -steamchina parameter".to_string(),
        }),
        Err(e) => Ok(RestartSteamChinaResponse {
            success: false,
            message: e,
        }),
    }
}

// ============== End Steam Management Commands ==============

// ============== Firewall Management ==============

/// Response structure for firewall status
#[derive(serde::Serialize)]
pub struct FirewallStatusResponse {
    pub domain_enabled: bool,
    pub private_enabled: bool,
    pub public_enabled: bool,
    pub message: String,
}

/// Response structure for firewall toggle
#[derive(serde::Serialize)]
pub struct FirewallToggleResponse {
    pub success: bool,
    pub message: String,
}

/// Response structure for core status
#[derive(serde::Serialize)]
pub struct CoreStatusResponse {
    pub is_running: bool,
    pub pid: Option<u32>,
    pub message: String,
}

/// Response structure for core control
#[derive(serde::Serialize)]
pub struct CoreControlResponse {
    pub success: bool,
    pub is_running: bool,
    pub pid: Option<u32>,
    pub message: String,
}

/// Get Windows Firewall status for all profiles
#[cfg(windows)]
fn get_firewall_status_windows() -> Result<FirewallStatusResponse, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    let output = Command::new("powershell")
        .args([
            "-Command",
            "Get-NetFirewallProfile | Select-Object -Property Name, Enabled | ConvertTo-Json"
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("PowerShell command failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Parse JSON output
    let profiles: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse firewall status: {}", e))?;
    
    let mut domain_enabled = false;
    let mut private_enabled = false;
    let mut public_enabled = false;
    
    if let Some(arr) = profiles.as_array() {
        for profile in arr {
            let name = profile.get("Name").and_then(|v| v.as_str()).unwrap_or("");
            // Enabled can be a bool (true/false) or a number (1/0)
            let enabled = profile.get("Enabled").map(|v| {
                v.as_bool().unwrap_or_else(|| {
                    v.as_i64().map(|n| n != 0).unwrap_or(false)
                })
            }).unwrap_or(false);
            
            match name {
                "Domain" => domain_enabled = enabled,
                "Private" => private_enabled = enabled,
                "Public" => public_enabled = enabled,
                _ => {}
            }
        }
    }
    
    Ok(FirewallStatusResponse {
        domain_enabled,
        private_enabled,
        public_enabled,
        message: "Firewall status retrieved successfully".to_string(),
    })
}

/// Set Windows Firewall status
#[cfg(windows)]
fn set_firewall_status_windows(enabled: bool) -> Result<FirewallToggleResponse, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    
    let state = if enabled { "True" } else { "False" };
    let cmd = format!(
        "Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled {}",
        state
    );
    
    let output = Command::new("powershell")
        .args(["-Command", &cmd])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to set firewall status: {}", stderr));
    }
    
    let action = if enabled { "enabled" } else { "disabled" };
    Ok(FirewallToggleResponse {
        success: true,
        message: format!("Windows Firewall {} successfully", action),
    })
}

#[cfg(not(windows))]
fn get_firewall_status_windows() -> Result<FirewallStatusResponse, String> {
    Err("Firewall management is only supported on Windows".to_string())
}

#[cfg(not(windows))]
fn set_firewall_status_windows(_enabled: bool) -> Result<FirewallToggleResponse, String> {
    Err("Firewall management is only supported on Windows".to_string())
}

#[tauri::command]
async fn get_firewall_status() -> Result<FirewallStatusResponse, String> {
    get_firewall_status_windows()
}

#[tauri::command]
async fn set_firewall(enabled: bool) -> Result<FirewallToggleResponse, String> {
    set_firewall_status_windows(enabled)
}

// ============== End Firewall Management ==============

// ============== ConnectToolCore Management ==============

/// Get the path to ConnectToolCore executable
fn get_core_executable_path() -> PathBuf {
    let current_exe = std::env::current_exe().unwrap_or_default();
    let current_dir = current_exe.parent().unwrap_or(std::path::Path::new("."));
    
    #[cfg(windows)]
    let core_name = "ConnectToolCore.exe";
    #[cfg(not(windows))]
    let core_name = "ConnectToolCore";
    
    current_dir.join(core_name)
}

/// Check if the core process is running by checking the managed process
fn check_core_process_running() -> (bool, Option<u32>) {
    let mut guard = CORE_PROCESS.lock().unwrap();
    
    if let Some(ref mut child) = *guard {
        // Try to check if process is still running
        match child.try_wait() {
            Ok(Some(_status)) => {
                // Process has exited
                *guard = None;
                (false, None)
            }
            Ok(None) => {
                // Process is still running
                (true, Some(child.id()))
            }
            Err(_) => {
                // Error checking, assume not running
                *guard = None;
                (false, None)
            }
        }
    } else {
        (false, None)
    }
}

/// Start the ConnectToolCore process
#[cfg(windows)]
fn start_core_process() -> Result<(bool, Option<u32>), String> {
    use std::os::windows::process::CommandExt;
    // 使用 CREATE_NEW_CONSOLE 让 Core 在独立的控制台窗口中运行，方便用户查看日志
    const CREATE_NEW_CONSOLE: u32 = 0x00000010;
    
    let core_path = get_core_executable_path();
    
    if !core_path.exists() {
        return Err(format!("ConnectToolCore not found at: {}", core_path.display()));
    }
    
    let mut guard = CORE_PROCESS.lock().unwrap();
    
    // Check if already running
    if let Some(ref mut child) = *guard {
        match child.try_wait() {
            Ok(None) => {
                // Already running
                return Ok((true, Some(child.id())));
            }
            _ => {
                // Process ended, clear it
                *guard = None;
            }
        }
    }
    
    // Start the process with a visible console window for log viewing
    let child = Command::new(&core_path)
        .current_dir(core_path.parent().unwrap_or(std::path::Path::new(".")))
        .creation_flags(CREATE_NEW_CONSOLE)
        .spawn()
        .map_err(|e| format!("Failed to start ConnectToolCore: {}", e))?;
    
    let pid = child.id();
    *guard = Some(child);
    
    // Wait a bit for the process to initialize
    std::thread::sleep(std::time::Duration::from_millis(500));
    
    Ok((true, Some(pid)))
}

#[cfg(not(windows))]
fn start_core_process() -> Result<(bool, Option<u32>), String> {
    let core_path = get_core_executable_path();
    
    if !core_path.exists() {
        return Err(format!("ConnectToolCore not found at: {}", core_path.display()));
    }
    
    let mut guard = CORE_PROCESS.lock().unwrap();
    
    // Check if already running
    if let Some(ref mut child) = *guard {
        match child.try_wait() {
            Ok(None) => {
                // Already running
                return Ok((true, Some(child.id())));
            }
            _ => {
                // Process ended, clear it
                *guard = None;
            }
        }
    }
    
    // Start the process
    let child = Command::new(&core_path)
        .current_dir(core_path.parent().unwrap_or(std::path::Path::new(".")))
        .spawn()
        .map_err(|e| format!("Failed to start ConnectToolCore: {}", e))?;
    
    let pid = child.id();
    *guard = Some(child);
    
    // Wait a bit for the process to initialize
    std::thread::sleep(std::time::Duration::from_millis(500));
    
    Ok((true, Some(pid)))
}

/// Stop the ConnectToolCore process
fn stop_core_process() -> Result<(), String> {
    let mut guard = CORE_PROCESS.lock().unwrap();
    
    if let Some(ref mut child) = *guard {
        // Try to kill the process
        child.kill().map_err(|e| format!("Failed to kill ConnectToolCore: {}", e))?;
        
        // Wait for it to finish
        let _ = child.wait();
        
        *guard = None;
        Ok(())
    } else {
        Ok(()) // Already not running
    }
}

#[tauri::command]
async fn get_core_status() -> Result<CoreStatusResponse, String> {
    let (is_running, pid) = check_core_process_running();
    
    let message = if is_running {
        format!("ConnectToolCore is running (PID: {})", pid.unwrap_or(0))
    } else {
        "ConnectToolCore is not running".to_string()
    };
    
    Ok(CoreStatusResponse {
        is_running,
        pid,
        message,
    })
}

#[tauri::command]
async fn get_core_version() -> Result<GetVersionResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .get_version(GetVersionRequest {})
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
}

#[tauri::command]
async fn start_core() -> Result<CoreControlResponse, String> {
    match start_core_process() {
        Ok((is_running, pid)) => Ok(CoreControlResponse {
            success: true,
            is_running,
            pid,
            message: "ConnectToolCore started successfully".to_string(),
        }),
        Err(e) => Ok(CoreControlResponse {
            success: false,
            is_running: false,
            pid: None,
            message: e,
        }),
    }
}

#[tauri::command]
async fn stop_core() -> Result<CoreControlResponse, String> {
    match stop_core_process() {
        Ok(()) => Ok(CoreControlResponse {
            success: true,
            is_running: false,
            pid: None,
            message: "ConnectToolCore stopped successfully".to_string(),
        }),
        Err(e) => Ok(CoreControlResponse {
            success: false,
            is_running: true,
            pid: None,
            message: e,
        }),
    }
}

// ============== End ConnectToolCore Management ==============

/// Cleanup function to stop core process when application exits
fn cleanup_core_on_exit() {
    if let Ok(()) = stop_core_process() {
        println!("ConnectToolCore stopped on application exit");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            create_lobby,
            join_lobby,
            leave_lobby,
            get_lobby_info,
            get_friend_lobbies,
            invite_friend,
            get_vpn_status,
            get_vpn_routing_table,
            find_steam,
            get_steam_running_status,
            restart_steam_china,
            get_firewall_status,
            set_firewall,
            get_core_status,
            get_core_version,
            start_core,
            stop_core
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Stop core process when the window is closed
                cleanup_core_on_exit();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
