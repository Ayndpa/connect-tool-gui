import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Text,
  Divider,
  Button,
  Spinner,
  makeStyles,
  tokens,
  Switch,
  Card,
  CardHeader,
  Badge,
} from "@fluentui/react-components";
import {
  ArrowSyncRegular,
  ShieldCheckmarkRegular,
  ShieldDismissRegular,
} from "@fluentui/react-icons";
import { useStyles as useGlobalStyles, containerGap, sectionGap } from "../styles";
import { FirewallStatusResponse, FirewallToggleResponse } from "../types";

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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profilesContainer: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
  },
  profileCard: {
    flex: "1 1 200px",
    minWidth: "200px",
  },
  cardContent: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  controlSection: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  buttonGroup: {
    display: "flex",
    gap: "12px",
  },
  warningText: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: tokens.fontSizeBase200,
  },
  infoText: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  centerContent: {
    padding: "32px",
    textAlign: "center",
  },
  summaryBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  allEnabledIcon: {
    color: tokens.colorPaletteGreenForeground1,
    fontSize: "24px",
  },
  allDisabledIcon: {
    color: tokens.colorPaletteRedForeground1,
    fontSize: "24px",
  },
});

interface FirewallTabProps {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function FirewallTab({ onError, onSuccess }: FirewallTabProps) {
  const styles = useGlobalStyles();
  const localStyles = useLocalStyles();

  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [firewallStatus, setFirewallStatus] = useState<FirewallStatusResponse | null>(null);

  const fetchFirewallStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await invoke<FirewallStatusResponse>("get_firewall_status");
      setFirewallStatus(status);
    } catch (e) {
      onError(`获取防火墙状态失败: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    fetchFirewallStatus();
  }, [fetchFirewallStatus]);

  const toggleFirewall = useCallback(async (enabled: boolean) => {
    setToggling(true);
    try {
      const result = await invoke<FirewallToggleResponse>("set_firewall", { enabled });
      if (result.success) {
        onSuccess(result.message);
        await fetchFirewallStatus();
      } else {
        onError(result.message);
      }
    } catch (e) {
      onError(`${enabled ? "开启" : "关闭"}防火墙失败: ${e}`);
    } finally {
      setToggling(false);
    }
  }, [onError, onSuccess, fetchFirewallStatus]);

  const allEnabled = firewallStatus && 
    firewallStatus.domain_enabled && 
    firewallStatus.private_enabled && 
    firewallStatus.public_enabled;

  const allDisabled = firewallStatus && 
    !firewallStatus.domain_enabled && 
    !firewallStatus.private_enabled && 
    !firewallStatus.public_enabled;

  const getOverallStatus = () => {
    if (!firewallStatus) return "未知";
    if (allEnabled) return "全部开启";
    if (allDisabled) return "全部关闭";
    return "部分开启";
  };

  const getStatusBadgeAppearance = (): "filled" | "outline" | "tint" => {
    if (allEnabled) return "filled";
    if (allDisabled) return "outline";
    return "tint";
  };

  const getStatusBadgeColor = (): "success" | "danger" | "warning" => {
    if (allEnabled) return "success";
    if (allDisabled) return "danger";
    return "warning";
  };

  return (
    <div className={localStyles.container}>
      {/* Status Section */}
      <div className={`${styles.card} ${localStyles.section}`}>
        <div className={localStyles.headerRow}>
          <div className={localStyles.summaryBadge}>
            {allEnabled ? (
              <ShieldCheckmarkRegular className={localStyles.allEnabledIcon} />
            ) : (
              <ShieldDismissRegular className={localStyles.allDisabledIcon} />
            )}
            <Text weight="semibold" size={400}>
              Windows 防火墙状态
            </Text>
          </div>
          <Button
            appearance="subtle"
            icon={<ArrowSyncRegular />}
            onClick={fetchFirewallStatus}
            disabled={loading || toggling}
          >
            刷新
          </Button>
        </div>

        <Divider />

        {loading ? (
          <div className={localStyles.centerContent}>
            <Spinner label="正在获取防火墙状态..." />
          </div>
        ) : firewallStatus ? (
          <>
            {/* Overall Status */}
            <div className={localStyles.statusRow}>
              <Text>总体状态：</Text>
              <Badge 
                appearance={getStatusBadgeAppearance()} 
                color={getStatusBadgeColor()}
              >
                {getOverallStatus()}
              </Badge>
            </div>

            {/* Profile Cards */}
            <div className={localStyles.profilesContainer}>
              <Card className={localStyles.profileCard}>
                <CardHeader
                  header={<Text weight="semibold">域网络</Text>}
                  description="Domain Profile"
                />
                <div className={localStyles.cardContent}>
                  <div className={localStyles.statusRow}>
                    <Switch
                      checked={firewallStatus.domain_enabled}
                      disabled
                      label={firewallStatus.domain_enabled ? "已启用" : "已禁用"}
                    />
                  </div>
                </div>
              </Card>

              <Card className={localStyles.profileCard}>
                <CardHeader
                  header={<Text weight="semibold">专用网络</Text>}
                  description="Private Profile"
                />
                <div className={localStyles.cardContent}>
                  <div className={localStyles.statusRow}>
                    <Switch
                      checked={firewallStatus.private_enabled}
                      disabled
                      label={firewallStatus.private_enabled ? "已启用" : "已禁用"}
                    />
                  </div>
                </div>
              </Card>

              <Card className={localStyles.profileCard}>
                <CardHeader
                  header={<Text weight="semibold">公用网络</Text>}
                  description="Public Profile"
                />
                <div className={localStyles.cardContent}>
                  <div className={localStyles.statusRow}>
                    <Switch
                      checked={firewallStatus.public_enabled}
                      disabled
                      label={firewallStatus.public_enabled ? "已启用" : "已禁用"}
                    />
                  </div>
                </div>
              </Card>
            </div>
          </>
        ) : (
          <div className={localStyles.centerContent}>
            <Text>无法获取防火墙状态</Text>
          </div>
        )}
      </div>

      {/* Control Section */}
      <div className={`${styles.card} ${localStyles.section}`}>
        <Text weight="semibold" size={400}>
          防火墙控制
        </Text>
        <Divider />
        
        <div className={localStyles.controlSection}>
          <Text className={localStyles.infoText}>
            以下操作将同时更改所有网络配置文件（域、专用、公用）的防火墙状态。
          </Text>
          <Text className={localStyles.warningText}>
            ⚠️ 警告：关闭防火墙会降低系统安全性，请谨慎操作。
          </Text>
          
          <div className={localStyles.buttonGroup}>
            <Button
              appearance="primary"
              icon={<ShieldCheckmarkRegular />}
              onClick={() => toggleFirewall(true)}
              disabled={loading || toggling || !!allEnabled}
            >
              {toggling ? "处理中..." : "开启防火墙"}
            </Button>
            <Button
              appearance="secondary"
              icon={<ShieldDismissRegular />}
              onClick={() => toggleFirewall(false)}
              disabled={loading || toggling || !!allDisabled}
            >
              {toggling ? "处理中..." : "关闭防火墙"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
