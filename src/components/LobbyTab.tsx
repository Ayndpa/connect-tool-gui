import { useState, useCallback, useEffect } from "react";
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
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
  Label,
  Persona,
  PersonaSize,
  PersonaPresence,
  IconButton,
  TooltipHost,
} from "@fluentui/react";
import { cardStyles, sectionStackTokens, containerStackTokens } from "../styles";
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

  // Columns
  const memberColumns: IColumn[] = [
    {
      key: "name",
      name: "名称",
      minWidth: 120,
      maxWidth: 200,
      onRender: (item: LobbyMember) => (
        <Persona text={item.name} size={PersonaSize.size24} presence={PersonaPresence.online} />
      ),
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
      ),
    },
  ];

  const friendLobbyColumns: IColumn[] = [
    {
      key: "name",
      name: "好友",
      minWidth: 120,
      onRender: (item: FriendLobby) => (
        <Persona text={item.name} size={PersonaSize.size24} presence={PersonaPresence.online} />
      ),
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
      ),
    },
  ];

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
    try {
      const res = await invoke<CreateLobbyResponse>("create_lobby");
      if (res.success) {
        refreshLobbyInfo();
        onSuccess("大厅创建成功！");
      } else {
        onError("创建大厅失败");
      }
    } catch (e) {
      console.error(e);
      onError(String(e));
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

  return (
    <Stack tokens={containerStackTokens} styles={{ root: { marginTop: 16 } }}>
      {/* Lobby Management */}
      <Stack styles={cardStyles} tokens={sectionStackTokens}>
        <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
          大厅
        </Text>

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
              <Text>
                当前大厅: <b>{currentLobbyId}</b>
              </Text>
              <TooltipHost content="复制到剪贴板">
                <IconButton
                  iconProps={{ iconName: "Copy" }}
                  onClick={() => {
                    navigator.clipboard.writeText(currentLobbyId);
                    onSuccess("已复制！");
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
          <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
            好友大厅
          </Text>
          <IconButton iconProps={{ iconName: "Refresh" }} onClick={handleGetFriendLobbies} title="刷新" />
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
  );
}
