import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Text,
  Button,
  Input,
  Divider,
  MessageBar,
  MessageBarBody,
  Label,
  Avatar,
  Tooltip,
  makeStyles,
  tokens,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from "@fluentui/react-components";
import {
  AddRegular,
  SignOutRegular,
  CopyRegular,
  PersonAddRegular,
  ArrowSyncRegular,
} from "@fluentui/react-icons";
import { useStyles as useGlobalStyles, containerGap, sectionGap } from "../styles";
import {
  LobbyMember,
  FriendLobby,
  GetLobbyInfoResponse,
  CreateLobbyResponse,
  JoinLobbyResponse,
  LeaveLobbyResponse,
  GetFriendLobbiesResponse,
  InviteFriendResponse,
} from "../types";

const useLocalStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: containerGap,
    marginTop: "16px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: sectionGap,
  },
  horizontalGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  inputWrapper: {
    width: "280px",
  },
  sectionTitle: {
    fontWeight: 600,
  },
  memberPing: {
    fontFamily: "monospace",
  },
  emptyText: {
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lobbyInfoBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  smallButton: {
    minWidth: "auto",
    height: "28px",
  },
});

interface LobbyTabProps {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function LobbyTab({ onError, onSuccess }: LobbyTabProps) {
  const [lobbyIdInput, setLobbyIdInput] = useState("");
  const [currentLobbyId, setCurrentLobbyId] = useState<string | null>(null);
  const [lobbyMembers, setLobbyMembers] = useState<LobbyMember[]>([]);
  const [friendLobbies, setFriendLobbies] = useState<FriendLobby[]>([]);
  const [inviteFriendId, setInviteFriendId] = useState("");
  const [isCreatingLobby, setIsCreatingLobby] = useState(false);

  const styles = useGlobalStyles();
  const localStyles = useLocalStyles();

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

  useEffect(() => {
    const interval = setInterval(() => {
      refreshLobbyInfo();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshLobbyInfo]);

  const handleCreateLobby = async () => {
    setIsCreatingLobby(true);
    try {
      const res = await invoke<CreateLobbyResponse>("create_lobby");
      if (res.success) {
        await refreshLobbyInfo();
        onSuccess("大厅创建成功！");
      } else {
        onError("创建大厅失败");
      }
    } catch (e) {
      console.error(e);
      onError(String(e));
    } finally {
      setIsCreatingLobby(false);
    }
  };

  const handleJoinLobby = async (id: string) => {
    if (!id) return;
    try {
      const res = await invoke<JoinLobbyResponse>("join_lobby", { lobbyId: id });
      if (res.success) {
        refreshLobbyInfo();
        setLobbyIdInput("");
        onSuccess("加入大厅成功！");
      } else {
        onError(`加入大厅失败: ${res.message}`);
      }
    } catch (e) {
      console.error(e);
      onError(String(e));
    }
  };

  const handleLeaveLobby = async () => {
    try {
      await invoke<LeaveLobbyResponse>("leave_lobby");
      refreshLobbyInfo();
      onSuccess("已离开大厅");
    } catch (e) {
      console.error(e);
      onError(String(e));
    }
  };

  const handleGetFriendLobbies = async () => {
    try {
      const res = await invoke<GetFriendLobbiesResponse>("get_friend_lobbies");
      setFriendLobbies(res.lobbies);
    } catch (e) {
      console.error(e);
      onError(String(e));
    }
  };

  const handleInviteFriend = async () => {
    if (!inviteFriendId) return;
    try {
      const res = await invoke<InviteFriendResponse>("invite_friend", { friendSteamId: inviteFriendId });
      if (res.success) {
        setInviteFriendId("");
        onSuccess("邀请已发送！");
      } else {
        onError("邀请好友失败");
      }
    } catch (e) {
      console.error(e);
      onError(String(e));
    }
  };

  const getPingColor = (ping: number) => {
    if (ping < 100) return tokens.colorPaletteGreenForeground1;
    if (ping < 200) return tokens.colorPaletteYellowForeground1;
    return tokens.colorPaletteRedForeground1;
  };

  return (
    <div className={localStyles.container}>
      {/* Lobby Management */}
      <div className={`${styles.card} ${localStyles.section}`}>
        <Text size={400} className={localStyles.sectionTitle}>
          大厅
        </Text>

        <div className={localStyles.horizontalGroup}>
          <Button
            appearance="primary"
            onClick={handleCreateLobby}
            disabled={!!currentLobbyId || isCreatingLobby}
            icon={<AddRegular />}
          >
            {isCreatingLobby ? "创建中..." : "创建大厅"}
          </Button>
          <Button
            onClick={handleLeaveLobby}
            disabled={!currentLobbyId}
            icon={<SignOutRegular />}
          >
            离开大厅
          </Button>
        </div>

        <div className={localStyles.section}>
          <Label htmlFor="lobby-id-input">通过大厅 ID 加入</Label>
          <div className={localStyles.horizontalGroup}>
            <Input
              id="lobby-id-input"
              value={lobbyIdInput}
              onChange={(_, data) => setLobbyIdInput(data.value)}
              disabled={!!currentLobbyId}
              placeholder="输入大厅 ID..."
              className={localStyles.inputWrapper}
            />
            <Button
              onClick={() => handleJoinLobby(lobbyIdInput)}
              disabled={!!currentLobbyId || !lobbyIdInput}
            >
              加入
            </Button>
          </div>
        </div>

        {currentLobbyId && (
          <MessageBar intent="success">
            <MessageBarBody>
              <div className={localStyles.lobbyInfoBar}>
                <Text>
                  当前大厅: <strong>{currentLobbyId}</strong>
                </Text>
                <Tooltip content="复制到剪贴板" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<CopyRegular />}
                    size="small"
                    onClick={() => {
                      navigator.clipboard.writeText(currentLobbyId);
                      onSuccess("已复制！");
                    }}
                  />
                </Tooltip>
              </div>
            </MessageBarBody>
          </MessageBar>
        )}

        {lobbyMembers.length > 0 && (
          <>
            <Divider />
            <Label>成员 ({lobbyMembers.length})</Label>
            <Table size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>名称</TableHeaderCell>
                  <TableHeaderCell>Steam ID</TableHeaderCell>
                  <TableHeaderCell>延迟</TableHeaderCell>
                  <TableHeaderCell>连接类型</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lobbyMembers.map((member) => (
                  <TableRow key={member.steam_id}>
                    <TableCell>
                      <div className={localStyles.horizontalGroup}>
                        <Avatar
                          name={member.name}
                          size={24}
                          color="colorful"
                          badge={{ status: "available" }}
                        />
                        <Text>{member.name}</Text>
                      </div>
                    </TableCell>
                    <TableCell>{member.steam_id}</TableCell>
                    <TableCell>
                      <Text
                        className={localStyles.memberPing}
                        style={{ color: getPingColor(member.ping) }}
                      >
                        {member.ping} ms
                      </Text>
                    </TableCell>
                    <TableCell>{member.relay_info}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        {currentLobbyId && (
          <>
            <Divider />
            <Label>邀请好友</Label>
            <div className={localStyles.horizontalGroup}>
              <Input
                value={inviteFriendId}
                onChange={(_, data) => setInviteFriendId(data.value)}
                placeholder="好友的 Steam ID"
                className={localStyles.inputWrapper}
              />
              <Button
                appearance="primary"
                onClick={handleInviteFriend}
                disabled={!inviteFriendId}
                icon={<PersonAddRegular />}
              >
                邀请
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Friend Lobbies */}
      <div className={`${styles.card} ${localStyles.section}`}>
        <div className={localStyles.headerRow}>
          <Text size={400} className={localStyles.sectionTitle}>
            好友大厅
          </Text>
          <Tooltip content="刷新" relationship="label">
            <Button
              appearance="subtle"
              icon={<ArrowSyncRegular />}
              onClick={handleGetFriendLobbies}
            />
          </Tooltip>
        </div>
        {friendLobbies.length > 0 ? (
          <Table size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>好友</TableHeaderCell>
                <TableHeaderCell>大厅 ID</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {friendLobbies.map((lobby) => (
                <TableRow key={lobby.lobby_id}>
                  <TableCell>
                    <div className={localStyles.horizontalGroup}>
                      <Avatar
                        name={lobby.name}
                        size={24}
                        color="colorful"
                        badge={{ status: "available" }}
                      />
                      <Text>{lobby.name}</Text>
                    </div>
                  </TableCell>
                  <TableCell>{lobby.lobby_id}</TableCell>
                  <TableCell>
                    <Button
                      appearance="primary"
                      size="small"
                      onClick={() => handleJoinLobby(lobby.lobby_id)}
                      className={localStyles.smallButton}
                    >
                      加入
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Text className={localStyles.emptyText}>
            当前没有好友在大厅中，点击刷新按钮检查。
          </Text>
        )}
      </div>
    </div>
  );
}
