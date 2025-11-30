use hyper_util::rt::tokio::TokioIo;
use tonic::transport::{Endpoint, Uri};
use tower::service_fn;

pub mod connecttool {
    tonic::include_proto!("connecttool");
}

use connecttool::connect_tool_service_client::ConnectToolServiceClient;
use connecttool::*;

#[cfg(windows)]
use tokio_util::compat::FuturesAsyncReadCompatExt;

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
async fn init_steam() -> Result<InitSteamResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .init_steam(InitSteamRequest {})
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
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
async fn start_vpn(ip: String, mask: String) -> Result<StartVpnResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .start_vpn(StartVpnRequest { ip, mask })
        .await
        .map_err(|e| e.to_string())?;
    Ok(response.into_inner())
}

#[tauri::command]
async fn stop_vpn() -> Result<StopVpnResponse, String> {
    let mut client = get_client().await?;
    let response = client
        .stop_vpn(StopVpnRequest {})
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            init_steam,
            create_lobby,
            join_lobby,
            leave_lobby,
            get_lobby_info,
            get_friend_lobbies,
            start_vpn,
            stop_vpn,
            get_vpn_status,
            get_vpn_routing_table
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
