import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Stack,
  Text,
  TextField,
  PrimaryButton,
  DefaultButton,
  Separator,
  MessageBar,
  MessageBarType,
  ThemeProvider,
  initializeIcons,
  IStackTokens,
  IStackStyles,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
  Label,
} from "@fluentui/react";

// Initialize icons
initializeIcons();

// Logic to determine Unix Domain Socket path based on platform
const isWindows = navigator.userAgent.includes("Windows");
const SOCKET_PATH = isWindows ? "connect_tool.sock" : "/tmp/connect_tool.sock";

const containerStackTokens: IStackTokens = { childrenGap: 20 };
const sectionStackTokens: IStackTokens = { childrenGap: 10 };
const mainStyles: IStackStyles = {
  root: {
    padding: 20,
    maxWidth: 800,
    margin: "0 auto",
    backgroundColor: "#faf9f8", // NeutralLighter
    minHeight: "100vh",
  },
};

const cardStyles: IStackStyles = {
  root: {
    backgroundColor: "white",
    padding: 20,
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    borderRadius: 4,
  },
};

// Interfaces based on proto
interface LobbyMember {
  steam_id: string;
  name: string;
  ping: number;
  relay_info: string;
}

interface FriendLobby {
  steam_id: string;
  name: string;
  lobby_id: string;
}

interface VPNStats {
  packets_sent: number;
  bytes_sent: number;
  packets_received: number;
  bytes_received: number;
  packets_dropped: number;
}

interface VPNRoute {
  ip: number;
  name: string;
  is_local: boolean;
}

// Response Interfaces
interface InitSteamResponse { success: boolean; message: string; }
interface CreateLobbyResponse { success: boolean; lobby_id: string; }
interface JoinLobbyResponse { success: boolean; message: string; }
interface LeaveLobbyResponse { success: boolean; }
interface GetLobbyInfoResponse { is_in_lobby: boolean; lobby_id: string; members: LobbyMember[]; }
interface GetFriendLobbiesResponse { lobbies: FriendLobby[]; }
interface StartVPNResponse { success: boolean; message: string; }
interface StopVPNResponse { success: boolean; }
interface GetVPNStatusResponse { enabled: boolean; local_ip: string; device_name: string; stats: VPNStats; }
interface GetVPNRoutingTableResponse { routes: VPNRoute[]; }

function App() {
  // State
  const [initResult, setInitResult] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [lobbyIdInput, setLobbyIdInput] = useState("");
  const [currentLobbyId, setCurrentLobbyId] = useState<string | null>(null);
  const [lobbyMembers, setLobbyMembers] = useState<LobbyMember[]>([]);

  const [friendLobbies, setFriendLobbies] = useState<FriendLobby[]>([]);

  const [vpnIp, setVpnIp] = useState("10.0.0.1");
  const [vpnMask, setVpnMask] = useState("255.255.255.0");
  const [vpnEnabled, setVpnEnabled] = useState(false);
  const [vpnStats, setVpnStats] = useState<VPNStats | null>(null);
  const [vpnRoutes, setVpnRoutes] = useState<VPNRoute[]>([]);

  // Columns for lists
  const memberColumns: IColumn[] = [
    { key: 'name', name: 'Name', fieldName: 'name', minWidth: 100, maxWidth: 200, isResizable: true },
    { key: 'steam_id', name: 'Steam ID', fieldName: 'steam_id', minWidth: 150, maxWidth: 200, isResizable: true },
    { key: 'ping', name: 'Ping', fieldName: 'ping', minWidth: 50, maxWidth: 100, isResizable: true },
  ];

  const friendLobbyColumns: IColumn[] = [
    { key: 'name', name: 'Friend Name', fieldName: 'name', minWidth: 100, maxWidth: 150 },
    { key: 'lobby_id', name: 'Lobby ID', fieldName: 'lobby_id', minWidth: 150, maxWidth: 200 },
    {
      key: 'action', name: 'Action', minWidth: 100,
      onRender: (item: FriendLobby) => (
        <PrimaryButton text="Join" onClick={() => handleJoinLobby(item.lobby_id)} styles={{ root: { height: 24, padding: '0 10px' } }} />
      )
    },
  ];

  const routeColumns: IColumn[] = [
    { key: 'ip', name: 'IP Address', fieldName: 'ip', minWidth: 100, maxWidth: 150, onRender: (item: VPNRoute) => ipToString(item.ip) },
    { key: 'name', name: 'Name', fieldName: 'name', minWidth: 100, maxWidth: 200 },
    { key: 'is_local', name: 'Local', fieldName: 'is_local', minWidth: 50, maxWidth: 100, onRender: (item: VPNRoute) => item.is_local ? "Yes" : "No" },
  ];

  // Helpers
  const ipToString = (ip: number) => {
    return `${(ip >> 24) & 0xFF}.${(ip >> 16) & 0xFF}.${(ip >> 8) & 0xFF}.${ip & 0xFF}`;
  };

  const handleError = (e: unknown) => {
    console.error(e);
    setErrorMsg(String(e));
    setTimeout(() => setErrorMsg(null), 5000);
  };

  // Data Fetching
  const refreshLobbyInfo = useCallback(async () => {
    try {
      const res = await invoke<GetLobbyInfoResponse>("get_lobby_info");
      if (res.is_in_lobby) {
        setCurrentLobbyId(res.lobby_id);
        setLobbyMembers(res.members);
      } else {
        setCurrentLobbyId(null);
        setLobbyMembers([]);
      }
    } catch (e) {
      console.error("Failed to get lobby info", e);
    }
  }, []);

  const refreshVPNStatus = useCallback(async () => {
    try {
      const res = await invoke<GetVPNStatusResponse>("get_vpn_status");
      setVpnEnabled(res.enabled);
      if (res.enabled) {
        setVpnStats(res.stats);
        // Also update routes if VPN is on
        const routesRes = await invoke<GetVPNRoutingTableResponse>("get_vpn_routing_table");
        setVpnRoutes(routesRes.routes);
      } else {
        setVpnStats(null);
        setVpnRoutes([]);
      }
    } catch (e) {
      console.error("Failed to get VPN status", e);
    }
  }, []);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(() => {
      refreshLobbyInfo();
      refreshVPNStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshLobbyInfo, refreshVPNStatus]);

  // Handlers
  const handleInitSteam = async () => {
    try {
      const res = await invoke<InitSteamResponse>("init_steam");
      setInitResult(res.success ? "Steam Initialized Successfully" : `Failed: ${res.message}`);
    } catch (e) {
      handleError(e);
    }
  };

  const handleCreateLobby = async () => {
    try {
      const res = await invoke<CreateLobbyResponse>("create_lobby");
      if (res.success) {
        refreshLobbyInfo();
      } else {
        handleError("Failed to create lobby");
      }
    } catch (e) {
      handleError(e);
    }
  };

  const handleJoinLobby = async (id: string) => {
    if (!id) return;
    try {
      const res = await invoke<JoinLobbyResponse>("join_lobby", { lobbyId: id });
      if (res.success) {
        refreshLobbyInfo();
      } else {
        handleError(`Failed to join lobby: ${res.message}`);
      }
    } catch (e) {
      handleError(e);
    }
  };

  const handleLeaveLobby = async () => {
    try {
      await invoke<LeaveLobbyResponse>("leave_lobby");
      refreshLobbyInfo();
    } catch (e) {
      handleError(e);
    }
  };

  const handleGetFriendLobbies = async () => {
    try {
      const res = await invoke<GetFriendLobbiesResponse>("get_friend_lobbies");
      setFriendLobbies(res.lobbies);
    } catch (e) {
      handleError(e);
    }
  };

  const handleStartVPN = async () => {
    try {
      const res = await invoke<StartVPNResponse>("start_vpn", { ip: vpnIp, mask: vpnMask });
      if (res.success) {
        refreshVPNStatus();
      } else {
        handleError(`Failed to start VPN: ${res.message}`);
      }
    } catch (e) {
      handleError(e);
    }
  };

  const handleStopVPN = async () => {
    try {
      await invoke<StopVPNResponse>("stop_vpn");
      refreshVPNStatus();
    } catch (e) {
      handleError(e);
    }
  };

  const handleGetRoutes = async () => {
    try {
      const res = await invoke<GetVPNRoutingTableResponse>("get_vpn_routing_table");
      setVpnRoutes(res.routes);
    } catch (e) {
      handleError(e);
    }
  };

  return (
    <ThemeProvider>
      <Stack styles={mainStyles} tokens={containerStackTokens}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge" styles={{ root: { fontWeight: "bold", color: "#0078d4" } }}>
            Connect Tool GUI
          </Text>
          <Text variant="small" styles={{ root: { color: "#666" } }}>
            Socket: {SOCKET_PATH}
          </Text>
        </Stack>

        <Separator />

        {errorMsg && (
          <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setErrorMsg(null)}>
            {errorMsg}
          </MessageBar>
        )}

        {/* Steam Initialization */}
        <Stack styles={cardStyles} tokens={sectionStackTokens}>
          <Text variant="xLarge">Steam Initialization</Text>
          <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center">
            <PrimaryButton text="Init Steam" onClick={handleInitSteam} />
            {initResult && <Text style={{ color: initResult.includes("Failed") ? "red" : "green" }}>{initResult}</Text>}
          </Stack>
        </Stack>

        {/* Lobby Management */}
        <Stack styles={cardStyles} tokens={sectionStackTokens}>
          <Text variant="xLarge">Lobby Management</Text>

          <Stack horizontal tokens={{ childrenGap: 10 }}>
            <PrimaryButton text="Create Lobby" onClick={handleCreateLobby} disabled={!!currentLobbyId} />
            <DefaultButton text="Leave Lobby" onClick={handleLeaveLobby} disabled={!currentLobbyId} />
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="end">
            <TextField
              label="Join Lobby ID"
              value={lobbyIdInput}
              onChange={(_, v) => setLobbyIdInput(v || "")}
              disabled={!!currentLobbyId}
            />
            <DefaultButton text="Join" onClick={() => handleJoinLobby(lobbyIdInput)} disabled={!!currentLobbyId || !lobbyIdInput} />
          </Stack>

          {currentLobbyId && (
            <MessageBar messageBarType={MessageBarType.success}>
              Current Lobby ID: {currentLobbyId}
            </MessageBar>
          )}

          {lobbyMembers.length > 0 && (
            <Stack>
              <Label>Lobby Members</Label>
              <DetailsList
                items={lobbyMembers}
                columns={memberColumns}
                layoutMode={DetailsListLayoutMode.justified}
                selectionMode={SelectionMode.none}
                compact={true}
              />
            </Stack>
          )}

          <Separator />

          <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center">
            <DefaultButton text="Refresh Friend Lobbies" onClick={handleGetFriendLobbies} />
          </Stack>

          {friendLobbies.length > 0 && (
            <Stack>
              <Label>Friend Lobbies</Label>
              <DetailsList
                items={friendLobbies}
                columns={friendLobbyColumns}
                layoutMode={DetailsListLayoutMode.justified}
                selectionMode={SelectionMode.none}
                compact={true}
              />
            </Stack>
          )}
        </Stack>

        {/* VPN Management */}
        <Stack styles={cardStyles} tokens={sectionStackTokens}>
          <Text variant="xLarge">VPN Management</Text>

          <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="end">
            <TextField label="IP Address" value={vpnIp} onChange={(_, v) => setVpnIp(v || "")} disabled={vpnEnabled} />
            <TextField label="Subnet Mask" value={vpnMask} onChange={(_, v) => setVpnMask(v || "")} disabled={vpnEnabled} />
            <PrimaryButton text="Start VPN" onClick={handleStartVPN} disabled={vpnEnabled} />
            <DefaultButton text="Stop VPN" onClick={handleStopVPN} disabled={!vpnEnabled} />
          </Stack>

          {vpnEnabled && (
            <MessageBar messageBarType={MessageBarType.success}>
              VPN is Running
            </MessageBar>
          )}

          {vpnStats && (
            <Stack tokens={{ childrenGap: 5 }} styles={{ root: { padding: 10, backgroundColor: "#f3f2f1" } }}>
              <Text variant="medium"><b>Stats:</b></Text>
              <Text>Sent: {vpnStats.packets_sent} pkts ({vpnStats.bytes_sent} bytes)</Text>
              <Text>Received: {vpnStats.packets_received} pkts ({vpnStats.bytes_received} bytes)</Text>
              <Text>Dropped: {vpnStats.packets_dropped} pkts</Text>
            </Stack>
          )}

          <Stack horizontal tokens={{ childrenGap: 10 }}>
            <DefaultButton text="Get Routing Table" onClick={handleGetRoutes} disabled={!vpnEnabled} />
          </Stack>

          {vpnRoutes.length > 0 && (
            <Stack>
              <Label>Routing Table</Label>
              <DetailsList
                items={vpnRoutes}
                columns={routeColumns}
                layoutMode={DetailsListLayoutMode.justified}
                selectionMode={SelectionMode.none}
                compact={true}
              />
            </Stack>
          )}
        </Stack>

      </Stack>
    </ThemeProvider>
  );
}

export default App;
