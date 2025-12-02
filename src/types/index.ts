// Interfaces based on proto
export interface LobbyMember {
  steam_id: string;
  name: string;
  ping: number;
  relay_info: string;
}

export interface FriendLobby {
  steam_id: string;
  name: string;
  lobby_id: string;
}

export interface VPNStats {
  packets_sent: number;
  bytes_sent: number;
  packets_received: number;
  bytes_received: number;
  packets_dropped: number;
}

export interface VPNRoute {
  ip: number;
  name: string;
  is_local: boolean;
}

// Response Interfaces
export interface InitSteamResponse {
  success: boolean;
  message: string;
}

export interface CreateLobbyResponse {
  success: boolean;
  lobby_id: string;
}

export interface JoinLobbyResponse {
  success: boolean;
  message: string;
}

export interface LeaveLobbyResponse {
  success: boolean;
}

export interface GetLobbyInfoResponse {
  is_in_lobby: boolean;
  lobby_id: string;
  members: LobbyMember[];
}

export interface GetFriendLobbiesResponse {
  lobbies: FriendLobby[];
}

export interface InviteFriendResponse {
  success: boolean;
}

export interface GetVPNStatusResponse {
  enabled: boolean;
  local_ip: string;
  device_name: string;
  stats: VPNStats;
}

export interface GetVPNRoutingTableResponse {
  routes: VPNRoute[];
}

export interface FindSteamPathResponse {
  found: boolean;
  steam_path: string | null;
  steam_exe_path: string | null;
  message: string;
}

export interface GetSteamStatusResponse {
  is_running: boolean;
  process_id: number | null;
}

export interface RestartSteamChinaResponse {
  success: boolean;
  message: string;
}
