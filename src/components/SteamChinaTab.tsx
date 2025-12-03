import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Text,
  Button,
  Divider,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ArrowSyncRegular, PlayRegular } from "@fluentui/react-icons";
import { useStyles as useGlobalStyles, containerGap, sectionGap } from "../styles";
import { FindSteamPathResponse, GetSteamStatusResponse, RestartSteamChinaResponse } from "../types";

const useLocalStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: containerGap,
    marginTop: "16px",
  },
  coreWarning: {
    marginBottom: "8px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: sectionGap,
  },
  horizontalGroup: {
    display: "flex",
    gap: "32px",
  },
  infoGroup: {
    display: "flex",
    flexDirection: "column",
  },
  infoLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  infoValue: {
    fontFamily: "monospace",
    fontWeight: 500,
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "32px",
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  statusText: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  actionRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  actionHint: {
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase200,
  },
  description: {
    color: tokens.colorNeutralForeground3,
  },
  sectionTitle: {
    fontWeight: 600,
  },
});

interface SteamChinaTabProps {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  coreRunning?: boolean;
  onStopCore?: () => Promise<unknown>;
}

export function SteamChinaTab({ onError, onSuccess, coreRunning, onStopCore }: SteamChinaTabProps) {
  const [steamPath, setSteamPath] = useState<string | null>(null);
  const [steamExePath, setSteamExePath] = useState<string | null>(null);
  const [isSteamRunning, setIsSteamRunning] = useState(false);
  const [steamProcessId, setSteamProcessId] = useState<number | null>(null);
  const [isRestartingSteam, setIsRestartingSteam] = useState(false);
  const [isStoppingCore, setIsStoppingCore] = useState(false);

  const styles = useGlobalStyles();
  const localStyles = useLocalStyles();

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
    // 如果 Core 正在运行，先停止它
    if (coreRunning && onStopCore) {
      setIsStoppingCore(true);
      try {
        await onStopCore();
        onSuccess("核心服务已停止");
        // 等待一小段时间确保 Core 完全停止
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.error("Failed to stop core:", e);
        onError(`停止核心服务失败: ${String(e)}`);
        setIsStoppingCore(false);
        return;
      } finally {
        setIsStoppingCore(false);
      }
    }

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
    <div className={localStyles.container}>
      <div className={`${styles.card} ${localStyles.section}`}>
        <Text size={400} className={localStyles.sectionTitle}>
          Steam 中国区启动器
        </Text>
        <Text className={localStyles.description}>
          此功能可以检测 Steam 是否正在运行，如果正在运行则关闭它，然后以 -steamchina 参数重新启动。
        </Text>

        <Divider />

        {/* Steam Installation Info */}
        <div className={localStyles.section}>
          <Text size={300} weight="semibold">
            Steam 安装信息
          </Text>

          <div className={localStyles.horizontalGroup}>
            <div className={localStyles.infoGroup}>
              <Text className={localStyles.infoLabel}>安装路径</Text>
              <Text className={localStyles.infoValue}>{steamPath || "未检测到"}</Text>
            </div>
            <div className={localStyles.infoGroup}>
              <Text className={localStyles.infoLabel}>可执行文件</Text>
              <Text className={localStyles.infoValue}>{steamExePath || "未检测到"}</Text>
            </div>
          </div>

          <div className={localStyles.statusRow}>
            <div className={localStyles.infoGroup}>
              <Text className={localStyles.infoLabel}>运行状态</Text>
              <div className={localStyles.statusText}>
                <div
                  className={localStyles.statusDot}
                  style={{
                    backgroundColor: isSteamRunning
                      ? tokens.colorPaletteGreenBackground3
                      : tokens.colorPaletteRedBackground3,
                  }}
                />
                <Text style={{ fontWeight: 500 }}>
                  {isSteamRunning ? "运行中" : "未运行"}
                </Text>
              </div>
            </div>
            {isSteamRunning && steamProcessId && (
              <div className={localStyles.infoGroup}>
                <Text className={localStyles.infoLabel}>进程 ID</Text>
                <Text className={localStyles.infoValue}>{steamProcessId}</Text>
              </div>
            )}
          </div>
        </div>

        <Divider />

        {/* Action Button */}
        <div className={localStyles.section}>
          <Text size={300} weight="semibold">
            操作
          </Text>

          {coreRunning && (
            <MessageBar intent="warning" className={localStyles.coreWarning}>
              <MessageBarBody>
                核心服务正在运行。点击下方按钮将会先自动停止核心服务，然后再操作 Steam。
              </MessageBarBody>
            </MessageBar>
          )}

          {steamPath ? (
            <div className={localStyles.actionRow}>
              <Button
                appearance="primary"
                onClick={handleRestartSteamChina}
                disabled={isRestartingSteam || isStoppingCore || !steamPath}
                icon={isSteamRunning ? <ArrowSyncRegular /> : <PlayRegular />}
              >
                {isStoppingCore
                  ? "正在停止核心服务..."
                  : isRestartingSteam
                  ? "正在处理..."
                  : isSteamRunning
                  ? "重启为中国区"
                  : "以中国区启动"}
              </Button>
              {isSteamRunning && (
                <Text className={localStyles.actionHint}>
                  将关闭当前 Steam 并以 -steamchina 参数重新启动
                </Text>
              )}
            </div>
          ) : (
            <MessageBar intent="warning">
              <MessageBarBody>
                未能检测到 Steam 安装路径。请确保 Steam 已正确安装。
              </MessageBarBody>
            </MessageBar>
          )}
        </div>

        {/* Info Box */}
        <MessageBar intent="info">
          <MessageBarBody>
            <Text size={200}>
              <strong>说明：</strong> -steamchina 参数用于以中国区模式启动 Steam，这可能会影响商店区域和某些功能。
              此功能会自动检测您的操作系统并查找 Steam 安装位置。
            </Text>
          </MessageBarBody>
        </MessageBar>
      </div>
    </div>
  );
}
