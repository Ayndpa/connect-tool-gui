import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Stack,
  Text,
  PrimaryButton,
  Separator,
  MessageBar,
  MessageBarType,
} from "@fluentui/react";
import { cardStyles, sectionStackTokens, containerStackTokens } from "../styles";
import { FindSteamPathResponse, GetSteamStatusResponse, RestartSteamChinaResponse } from "../types";

interface SteamChinaTabProps {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function SteamChinaTab({ onError, onSuccess }: SteamChinaTabProps) {
  const [steamPath, setSteamPath] = useState<string | null>(null);
  const [steamExePath, setSteamExePath] = useState<string | null>(null);
  const [isSteamRunning, setIsSteamRunning] = useState(false);
  const [steamProcessId, setSteamProcessId] = useState<number | null>(null);
  const [isRestartingSteam, setIsRestartingSteam] = useState(false);

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
    refreshSteamStatus();
    const interval = setInterval(() => {
      refreshSteamStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshSteamStatus]);

  const handleRestartSteamChina = async () => {
    setIsRestartingSteam(true);
    try {
      const res = await invoke<RestartSteamChinaResponse>("restart_steam_china");
      if (res.success) {
        onSuccess(res.message);
        // Refresh Steam status after a short delay
        setTimeout(() => refreshSteamStatus(), 3000);
      } else {
        onError(res.message);
      }
    } catch (e) {
      console.error(e);
      onError(String(e));
    } finally {
      setIsRestartingSteam(false);
    }
  };

  return (
    <Stack tokens={containerStackTokens} styles={{ root: { marginTop: 16 } }}>
      <Stack styles={cardStyles} tokens={sectionStackTokens}>
        <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
          Steam 中国区启动器
        </Text>
        <Text styles={{ root: { color: "#605e5c" } }}>
          此功能可以检测 Steam 是否正在运行，如果正在运行则关闭它，然后以 -steamchina 参数重新启动。
        </Text>

        <Separator />

        {/* Steam Installation Info */}
        <Stack tokens={{ childrenGap: 8 }}>
          <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
            Steam 安装信息
          </Text>

          <Stack horizontal tokens={{ childrenGap: 32 }}>
            <Stack>
              <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                安装路径
              </Text>
              <Text styles={{ root: { fontFamily: "monospace", fontWeight: 500 } }}>{steamPath || "未检测到"}</Text>
            </Stack>
            <Stack>
              <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                可执行文件
              </Text>
              <Text styles={{ root: { fontFamily: "monospace", fontWeight: 500 } }}>{steamExePath || "未检测到"}</Text>
            </Stack>
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 32 }} verticalAlign="center">
            <Stack>
              <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                运行状态
              </Text>
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: isSteamRunning ? "#107c10" : "#d13438",
                  }}
                />
                <Text styles={{ root: { fontWeight: 500 } }}>{isSteamRunning ? "运行中" : "未运行"}</Text>
              </Stack>
            </Stack>
            {isSteamRunning && steamProcessId && (
              <Stack>
                <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                  进程 ID
                </Text>
                <Text styles={{ root: { fontFamily: "monospace", fontWeight: 500 } }}>{steamProcessId}</Text>
              </Stack>
            )}
          </Stack>
        </Stack>

        <Separator />

        {/* Action Button */}
        <Stack tokens={{ childrenGap: 12 }}>
          <Text variant="mediumPlus" styles={{ root: { fontWeight: 600 } }}>
            操作
          </Text>

          {steamPath ? (
            <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
              <PrimaryButton
                text={isRestartingSteam ? "正在处理..." : isSteamRunning ? "重启为中国区" : "以中国区启动"}
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
  );
}
