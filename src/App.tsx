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
  Pivot,
  PivotItem,
  ProgressIndicator,
  Persona,
  PersonaSize,
  PersonaPresence,
  IconButton,
  TooltipHost,
  mergeStyles,
} from "@fluentui/react";

// Initialize icons
initializeIcons();

const containerStackTokens: IStackTokens = { childrenGap: 16 };
const sectionStackTokens: IStackTokens = { childrenGap: 12 };

const mainStyles: IStackStyles = {
  root: {
    padding: 24,
    maxWidth: 900,
    margin: "0 auto",
    backgroundColor: "#faf9f8",
    minHeight: "100vh",
  },
};

const cardStyles: IStackStyles = {
  root: {
    backgroundColor: "white",
    padding: 20,
    boxShadow: "0 1.6px 3.6px 0 rgba(0,0,0,0.132), 0 0.3px 0.9px 0 rgba(0,0,0,0.108)",
    borderRadius: 4,
  },
};

const headerClass = mergeStyles({
  background: "linear-gradient(135deg, #0078d4 0%, #106ebe 100%)",
  padding: "20px 24px",
  borderRadius: 4,
  marginBottom: 16,
});

const statsCardClass = mergeStyles({
  backgroundColor: "#f3f2f1",
  padding: 16,
  borderRadius: 4,
  textAlign: "center",
});

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
interface InviteFriendResponse { success: boolean; }
interface GetVPNStatusResponse { enabled: boolean; local_ip: string; device_name: string; stats: VPNStats; }
interface GetVPNRoutingTableResponse { routes: VPNRoute[]; }
interface FindSteamPathResponse { found: boolean; steam_path: string | null; steam_exe_path: string | null; message: string; }
interface GetSteamStatusResponse { is_running: boolean; process_id: number | null; }
interface RestartSteamChinaResponse { success: boolean; message: string; }

function App() {
  // State
  const [steamInitialized, setSteamInitialized] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [lobbyIdInput, setLobbyIdInput] = useState("");
  const [currentLobbyId, setCurrentLobbyId] = useState<string | null>(null);
  const [lobbyMembers, setLobbyMembers] = useState<LobbyMember[]>([]);

  const [friendLobbies, setFriendLobbies] = useState<FriendLobby[]>([]);
  const [inviteFriendId, setInviteFriendId] = useState("");

  const [vpnEnabled, setVpnEnabled] = useState(false);
  const [vpnStats, setVpnStats] = useState<VPNStats | null>(null);
  const [vpnLocalIp, setVpnLocalIp] = useState("");
  const [vpnDeviceName, setVpnDeviceName] = useState("");
  const [vpnRoutes, setVpnRoutes] = useState<VPNRoute[]>([]);

  // Steam China state
  const [steamPath, setSteamPath] = useState<string | null>(null);
  const [steamExePath, setSteamExePath] = useState<string | null>(null);
  const [isSteamRunning, setIsSteamRunning] = useState(false);
  const [steamProcessId, setSteamProcessId] = useState<number | null>(null);
  const [isRestartingSteam, setIsRestartingSteam] = useState(false);

  // Helpers
  const ipToString = (ip: number) => {
    return `${(ip >> 24) & 0xFF}.${(ip >> 16) & 0xFF}.${(ip >> 8) & 0xFF}.${ip & 0xFF}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleError = (e: unknown) => {
    console.error(e);
    setErrorMsg(String(e));
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Columns
  const memberColumns: IColumn[] = [
    { 
      key: "name", 
      name: "名称", 
      minWidth: 120, 
      maxWidth: 200,
      onRender: (item: LobbyMember) => (
        <Persona text={item.name} size={PersonaSize.size24} presence={PersonaPresence.online} />
      )
    },
    { key: "steam_id", name: "Steam ID", fieldName: "steam_id", minWidth: 150, maxWidth: 200 },
    { 
      key: "ping", 
      name: "延迟", 
      minWidth: 60, 
      maxWidth: 80,
      onRender: (item: LobbyMember) => (
        <Text style={{ color: item.ping < 50 ? "#107c10" : item.ping < 100 ? "#ffaa00" : "#d13438" }}>
          {item.ping} ms
        </Text>
      )
    },
  ];

  const friendLobbyColumns: IColumn[] = [
    { 
      key: "name", 
      name: "好友", 
      minWidth: 120,
      onRender: (item: FriendLobby) => (
        <Persona text={item.name} size={PersonaSize.size24} presence={PersonaPresence.online} />
      )
    },
    { key: "lobby_id", name: "大厅 ID", fieldName: "lobby_id", minWidth: 150, maxWidth: 200 },
    {
      key: "action", 
      name: "", 
      minWidth: 80,
      onRender: (item: FriendLobby) => (
        <PrimaryButton 
          text="加入" 
          onClick={() => handleJoinLobby(item.lobby_id)} 
          styles={{ root: { height: 28 } }} 
        />
      )
    },
  ];

  const routeColumns: IColumn[] = [
    { 
      key: "ip", 
      name: "IP 地址", 
      minWidth: 120,
      onRender: (item: VPNRoute) => <Text style={{ fontFamily: "monospace" }}>{ipToString(item.ip)}</Text>
    },
    { key: "name", name: "名称", fieldName: "name", minWidth: 150 },
    { 
      key: "is_local", 
      name: "类型", 
      minWidth: 80,
      onRender: (item: VPNRoute) => (
        <Text style={{ color: item.is_local ? "#107c10" : "#0078d4" }}>
          {item.is_local ? "本地" : "远程"}
        </Text>
      )
    },
  ];

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
        setVpnLocalIp(res.local_ip);
        setVpnDeviceName(res.device_name);
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

  const refreshSteamStatus = useCallback(async () => {
    try {
      // Find Steam path
      const pathRes = await invoke<FindSteamPathResponse>("find_steam");
      setSteamPath(pathRes.steam_path);
      setSteamExePath(pathRes.steam_exe_path);

      // Check if Steam is running
      const statusRes = await invoke<GetSteamStatusResponse>("get_steam_running_status");
      setIsSteamRunning(statusRes.is_running);
      setSteamProcessId(statusRes.process_id);
    } catch (e) {
      console.error("Failed to get Steam status", e);
    }
  }, []);

  useEffect(() => {
    // Initial refresh
    refreshSteamStatus();
    
    const interval = setInterval(() => {
      refreshLobbyInfo();
      refreshVPNStatus();
      refreshSteamStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshLobbyInfo, refreshVPNStatus, refreshSteamStatus]);

  // Handlers
  const handleInitSteam = async () => {
    try {
      const res = await invoke<InitSteamResponse>("init_steam");
      if (res.success) {
        setSteamInitialized(true);
        showSuccess("Steam 初始化成功！");
      } else {
        handleError(`失败: ${res.message}`);
      }
    } catch (e) {
      handleError(e);
    }
  };

  const handleCreateLobby = async () => {
    try {
      const res = await invoke<CreateLobbyResponse>("create_lobby");
      if (res.success) {
        refreshLobbyInfo();
        showSuccess("大厅创建成功！");
      } else {
        handleError("创建大厅失败");
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
        setLobbyIdInput("");
        showSuccess("加入大厅成功！");
      } else {
        handleError(`加入大厅失败: ${res.message}`);
      }
    } catch (e) {
      handleError(e);
    }
  };

  const handleLeaveLobby = async () => {
    try {
      await invoke<LeaveLobbyResponse>("leave_lobby");
      refreshLobbyInfo();
      showSuccess("已离开大厅");
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

  const handleInviteFriend = async () => {
    if (!inviteFriendId) return;
    try {
      const res = await invoke<InviteFriendResponse>("invite_friend", { friendSteamId: inviteFriendId });
      if (res.success) {
        setInviteFriendId("");
        showSuccess("邀请已发送！");
      } else {
        handleError("邀请好友失败");
      }
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

  const handleRestartSteamChina = async () => {
    setIsRestartingSteam(true);
    try {
      const res = await invoke<RestartSteamChinaResponse>("restart_steam_china");
      if (res.success) {
        showSuccess(res.message);
        // Refresh Steam status after a short delay
        setTimeout(() => refreshSteamStatus(), 3000);
      } else {
        handleError(res.message);
      }
    } catch (e) {
      handleError(e);
    } finally {
      setIsRestartingSteam(false);
    }
  };

  return (
    <ThemeProvider>
      <Stack styles={mainStyles} tokens={containerStackTokens}>
        {/* Header */}
        <div className={headerClass}>
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Stack>
              <Text variant="xLarge" styles={{ root: { color: "white", fontWeight: 600 } }}>
                连接工具
              </Text>
              <Text variant="small" styles={{ root: { color: "rgba(255,255,255,0.8)" } }}>
                Steam 网络 & VPN 管理器
              </Text>
            </Stack>
            <Stack horizontal tokens={{ childrenGap: 16 }}>
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  backgroundColor: steamInitialized ? "#92c353" : "#c8c6c4"
                }} />
                <Text styles={{ root: { color: "rgba(255,255,255,0.9)", fontSize: 12 } }}>
                  Steam
                </Text>
              </Stack>
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  backgroundColor: vpnEnabled ? "#92c353" : "#c8c6c4"
                }} />
                <Text styles={{ root: { color: "rgba(255,255,255,0.9)", fontSize: 12 } }}>
                  VPN
                </Text>
              </Stack>
            </Stack>
          </Stack>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setErrorMsg(null)}>
            {errorMsg}
          </MessageBar>
        )}
        {successMsg && (
          <MessageBar messageBarType={MessageBarType.success} onDismiss={() => setSuccessMsg(null)}>
            {successMsg}
          </MessageBar>
        )}

        {/* Main Content with Pivot */}
        <Pivot aria-label="主导航">
          {/* Steam & Lobby Tab */}
          <PivotItem headerText="大厅" itemIcon="Group">
            <Stack tokens={containerStackTokens} styles={{ root: { marginTop: 16 } }}>
              {/* Steam Init */}
              <Stack styles={cardStyles} tokens={sectionStackTokens}>
                <Text variant="large" styles={{ root: { fontWeight: 600 } }}>Steam 连接</Text>
                <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
                  <PrimaryButton 
                    text={steamInitialized ? "重新连接" : "初始化 Steam"} 
                    onClick={handleInitSteam}
                    iconProps={{ iconName: steamInitialized ? "Refresh" : "Play" }}
                  />
                  {steamInitialized && (
                    <Text styles={{ root: { color: "#107c10" } }}> 已连接</Text>
                  )}
                </Stack>
              </Stack>

              {/* Lobby Management */}
              <Stack styles={cardStyles} tokens={sectionStackTokens}>
                <Text variant="large" styles={{ root: { fontWeight: 600 } }}>大厅</Text>
                
                <Stack horizontal tokens={{ childrenGap: 12 }}>
                  <PrimaryButton 
                    text="创建大厅" 
                    onClick={handleCreateLobby} 
                    disabled={!!currentLobbyId}
                    iconProps={{ iconName: "Add" }}
                  />
                  <DefaultButton 
                    text="离开大厅" 
                    onClick={handleLeaveLobby} 
                    disabled={!currentLobbyId}
                    iconProps={{ iconName: "Leave" }}
                  />
                </Stack>

                <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="end">
                  <TextField
                    label="通过大厅 ID 加入"
                    value={lobbyIdInput}
                    onChange={(_, v) => setLobbyIdInput(v || "")}
                    disabled={!!currentLobbyId}
                    styles={{ root: { width: 280 } }}
                    placeholder="输入大厅 ID..."
                  />
                  <DefaultButton 
                    text="加入" 
                    onClick={() => handleJoinLobby(lobbyIdInput)} 
                    disabled={!!currentLobbyId || !lobbyIdInput}
                  />
                </Stack>

                {currentLobbyId && (
                  <MessageBar messageBarType={MessageBarType.success}>
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                      <Text>当前大厅: <b>{currentLobbyId}</b></Text>
                      <TooltipHost content="复制到剪贴板">
                        <IconButton 
                          iconProps={{ iconName: "Copy" }}
                          onClick={() => {
                            navigator.clipboard.writeText(currentLobbyId);
                            showSuccess("已复制！");
                          }}
                        />
                      </TooltipHost>
                    </Stack>
                  </MessageBar>
                )}

                {lobbyMembers.length > 0 && (
                  <>
                    <Separator />
                    <Label>成员 ({lobbyMembers.length})</Label>
                    <DetailsList
                      items={lobbyMembers}
                      columns={memberColumns}
                      layoutMode={DetailsListLayoutMode.justified}
                      selectionMode={SelectionMode.none}
                      compact
                    />
                  </>
                )}

                {currentLobbyId && (
                  <>
                    <Separator />
                    <Label>邀请好友</Label>
                    <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="end">
                      <TextField
                        value={inviteFriendId}
                        onChange={(_, v) => setInviteFriendId(v || "")}
                        placeholder="好友的 Steam ID"
                        styles={{ root: { width: 280 } }}
                      />
                      <PrimaryButton 
                        text="邀请" 
                        onClick={handleInviteFriend}
                        disabled={!inviteFriendId}
                        iconProps={{ iconName: "AddFriend" }}
                      />
                    </Stack>
                  </>
                )}
              </Stack>

              {/* Friend Lobbies */}
              <Stack styles={cardStyles} tokens={sectionStackTokens}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                  <Text variant="large" styles={{ root: { fontWeight: 600 } }}>好友大厅</Text>
                  <IconButton 
                    iconProps={{ iconName: "Refresh" }}
                    onClick={handleGetFriendLobbies}
                    title="刷新"
                  />
                </Stack>
                {friendLobbies.length > 0 ? (
                  <DetailsList
                    items={friendLobbies}
                    columns={friendLobbyColumns}
                    layoutMode={DetailsListLayoutMode.justified}
                    selectionMode={SelectionMode.none}
                    compact
                  />
                ) : (
                  <Text styles={{ root: { color: "#605e5c", fontStyle: "italic" } }}>
                    当前没有好友在大厅中，点击刷新按钮检查。
                  </Text>
                )}
              </Stack>
            </Stack>
          </PivotItem>

          {/* VPN Tab */}
          <PivotItem headerText="VPN" itemIcon="Shield">
            <Stack tokens={containerStackTokens} styles={{ root: { marginTop: 16 } }}>
              <Stack styles={cardStyles} tokens={sectionStackTokens}>
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                  <Text variant="large" styles={{ root: { fontWeight: 600 } }}>VPN 状态</Text>
                  <Text styles={{ 
                    root: { 
                      padding: "4px 12px", 
                      borderRadius: 12,
                      backgroundColor: vpnEnabled ? "#dff6dd" : "#f3f2f1",
                      color: vpnEnabled ? "#107c10" : "#605e5c"
                    } 
                  }}>
                    {vpnEnabled ? " 已启用" : " 未启用"}
                  </Text>
                </Stack>

                {vpnEnabled && vpnStats ? (
                  <>
                    {/* VPN Info */}
                    <Stack horizontal tokens={{ childrenGap: 32 }}>
                      <Stack>
                        <Text variant="small" styles={{ root: { color: "#605e5c" } }}>本地 IP</Text>
                        <Text styles={{ root: { fontFamily: "monospace", fontWeight: 600 } }}>
                          {vpnLocalIp || "无"}
                        </Text>
                      </Stack>
                      <Stack>
                        <Text variant="small" styles={{ root: { color: "#605e5c" } }}>设备</Text>
                        <Text styles={{ root: { fontFamily: "monospace", fontWeight: 600 } }}>
                          {vpnDeviceName || "无"}
                        </Text>
                      </Stack>
                    </Stack>

                    <Separator />

                    {/* Stats */}
                    <Label>流量统计</Label>
                    <Stack horizontal tokens={{ childrenGap: 16 }}>
                      <div className={statsCardClass} style={{ flex: 1 }}>
                        <Text variant="xxLarge" styles={{ root: { fontWeight: 600, color: "#0078d4" } }}>
                          {vpnStats.packets_sent.toLocaleString()}
                        </Text>
                        <Text variant="small" styles={{ root: { color: "#605e5c" } }}>已发送数据包</Text>
                        <Text variant="tiny" styles={{ root: { color: "#a19f9d" } }}>
                          {formatBytes(vpnStats.bytes_sent)}
                        </Text>
                      </div>
                      <div className={statsCardClass} style={{ flex: 1 }}>
                        <Text variant="xxLarge" styles={{ root: { fontWeight: 600, color: "#107c10" } }}>
                          {vpnStats.packets_received.toLocaleString()}
                        </Text>
                        <Text variant="small" styles={{ root: { color: "#605e5c" } }}>已接收数据包</Text>
                        <Text variant="tiny" styles={{ root: { color: "#a19f9d" } }}>
                          {formatBytes(vpnStats.bytes_received)}
                        </Text>
                      </div>
                      <div className={statsCardClass} style={{ flex: 1 }}>
                        <Text variant="xxLarge" styles={{ root: { fontWeight: 600, color: "#d13438" } }}>
                          {vpnStats.packets_dropped.toLocaleString()}
                        </Text>
                        <Text variant="small" styles={{ root: { color: "#605e5c" } }}>已丢弃</Text>
                        <ProgressIndicator 
                          percentComplete={vpnStats.packets_sent > 0 ? vpnStats.packets_dropped / vpnStats.packets_sent : 0}
                          barHeight={4}
                          styles={{ progressBar: { backgroundColor: "#d13438" } }}
                        />
                      </div>
                    </Stack>

                    <Separator />

                    {/* Routing Table */}
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                      <Label>路由表 ({vpnRoutes.length} 条路由)</Label>
                      <IconButton 
                        iconProps={{ iconName: "Refresh" }}
                        onClick={handleGetRoutes}
                        title="刷新路由"
                      />
                    </Stack>
                    {vpnRoutes.length > 0 && (
                      <DetailsList
                        items={vpnRoutes}
                        columns={routeColumns}
                        layoutMode={DetailsListLayoutMode.justified}
                        selectionMode={SelectionMode.none}
                        compact
                      />
                    )}
                  </>
                ) : (
                  <Stack horizontalAlign="center" styles={{ root: { padding: 32 } }}>
                    <Text styles={{ root: { color: "#605e5c" } }}>
                      VPN 未启用。加入大厅以启用 VPN。
                    </Text>
                  </Stack>
                )}
              </Stack>
            </Stack>
          </PivotItem>

          {/* Steam China Tab */}
          <PivotItem headerText="Steam 中国区" itemIcon="Globe">
            <Stack tokens={containerStackTokens} styles={{ root: { marginTop: 16 } }}>
              <Stack styles={cardStyles} tokens={sectionStackTokens}>
                <Text variant="large" styles={{ root: { fontWeight: 600 } }}>Steam 中国区启动器</Text>
                <Text styles={{ root: { color: "#605e5c" } }}>
                  此功能可以检测 Steam 是否正在运行，如果正在运行则关闭它，然后以 -steamchina 参数重新启动。
                </Text>

                <Separator />

                {/* Steam Installation Info */}
                <Stack tokens={{ childrenGap: 8 }}>
                  <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>Steam 安装信息</Text>
                  
                  <Stack horizontal tokens={{ childrenGap: 32 }}>
                    <Stack>
                      <Text variant="small" styles={{ root: { color: "#605e5c" } }}>安装路径</Text>
                      <Text styles={{ root: { fontFamily: "monospace", fontWeight: 500 } }}>
                        {steamPath || "未检测到"}
                      </Text>
                    </Stack>
                    <Stack>
                      <Text variant="small" styles={{ root: { color: "#605e5c" } }}>可执行文件</Text>
                      <Text styles={{ root: { fontFamily: "monospace", fontWeight: 500 } }}>
                        {steamExePath || "未检测到"}
                      </Text>
                    </Stack>
                  </Stack>

                  <Stack horizontal tokens={{ childrenGap: 32 }} verticalAlign="center">
                    <Stack>
                      <Text variant="small" styles={{ root: { color: "#605e5c" } }}>运行状态</Text>
                      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: "50%",
                          backgroundColor: isSteamRunning ? "#107c10" : "#d13438"
                        }} />
                        <Text styles={{ root: { fontWeight: 500 } }}>
                          {isSteamRunning ? "运行中" : "未运行"}
                        </Text>
                      </Stack>
                    </Stack>
                    {isSteamRunning && steamProcessId && (
                      <Stack>
                        <Text variant="small" styles={{ root: { color: "#605e5c" } }}>进程 ID</Text>
                        <Text styles={{ root: { fontFamily: "monospace", fontWeight: 500 } }}>
                          {steamProcessId}
                        </Text>
                      </Stack>
                    )}
                  </Stack>
                </Stack>

                <Separator />

                {/* Action Button */}
                <Stack tokens={{ childrenGap: 12 }}>
                  <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>操作</Text>
                  
                  {steamPath ? (
                    <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
                      <PrimaryButton
                        text={isRestartingSteam ? "正在处理..." : (isSteamRunning ? "重启为中国区" : "以中国区启动")}
                        onClick={handleRestartSteamChina}
                        disabled={isRestartingSteam || !steamPath}
                        iconProps={{ iconName: isSteamRunning ? "Refresh" : "Play" }}
                        styles={{ root: { minWidth: 150 } }}
                      />
                      {isSteamRunning && (
                        <Text styles={{ root: { color: "#a19f9d", fontSize: 12 } }}>
                          将关闭当前 Steam 并以 -steamchina 参数重新启动
                        </Text>
                      )}
                    </Stack>
                  ) : (
                    <MessageBar messageBarType={MessageBarType.warning}>
                      未能检测到 Steam 安装路径。请确保 Steam 已正确安装。
                    </MessageBar>
                  )}
                </Stack>

                {/* Info Box */}
                <MessageBar messageBarType={MessageBarType.info} isMultiline>
                  <Text variant="small">
                    <b>说明：</b> -steamchina 参数用于以中国区模式启动 Steam，这可能会影响商店区域和某些功能。
                    此功能会自动检测您的操作系统并查找 Steam 安装位置。
                  </Text>
                </MessageBar>
              </Stack>
            </Stack>
          </PivotItem>
        </Pivot>
      </Stack>
    </ThemeProvider>
  );
}

export default App;
