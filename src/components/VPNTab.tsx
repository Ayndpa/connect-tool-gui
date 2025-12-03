import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Text,
  Divider,
  Label,
  Button,
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
import { ArrowSyncRegular } from "@fluentui/react-icons";
import { useStyles as useGlobalStyles, containerGap, sectionGap } from "../styles";
import { ipToString, formatBytes } from "../utils/helpers";
import { VPNStats, VPNRoute, GetVPNStatusResponse, GetVPNRoutingTableResponse } from "../types";

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
  horizontalGroup: {
    display: "flex",
    gap: "32px",
  },
  statsRow: {
    display: "flex",
    gap: "16px",
  },
  statsCard: {
    flex: 1,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: "16px",
    borderRadius: tokens.borderRadiusMedium,
    textAlign: "center",
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
    fontWeight: 600,
  },
  statusBadge: {
    padding: "4px 12px",
    borderRadius: "12px",
    fontSize: tokens.fontSizeBase200,
  },
  statusEnabled: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
  },
  statusDisabled: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
  },
  centerContent: {
    padding: "32px",
    textAlign: "center",
  },
  emptyText: {
    color: tokens.colorNeutralForeground3,
  },
  monospace: {
    fontFamily: "monospace",
  },
  statsNumber: {
    fontWeight: 600,
    fontSize: tokens.fontSizeHero700,
  },
  statsLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  statsSubLabel: {
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase100,
  },
});

interface VPNTabProps {
  onError: (msg: string) => void;
  onVpnStatusChange?: (enabled: boolean) => void;
}

export function VPNTab({ onError, onVpnStatusChange }: VPNTabProps) {
  const [vpnEnabled, setVpnEnabled] = useState(false);
  const [vpnStats, setVpnStats] = useState<VPNStats | null>(null);
  const [vpnLocalIp, setVpnLocalIp] = useState("");
  const [vpnDeviceName, setVpnDeviceName] = useState("");
  const [vpnRoutes, setVpnRoutes] = useState<VPNRoute[]>([]);

  const styles = useGlobalStyles();
  const localStyles = useLocalStyles();

  const refreshVPNStatus = useCallback(async () => {
    try {
      const res = await invoke<GetVPNStatusResponse>("get_vpn_status");
      setVpnEnabled(res.enabled);
      onVpnStatusChange?.(res.enabled);
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
  }, [onVpnStatusChange]);

  useEffect(() => {
    refreshVPNStatus();
    const interval = setInterval(() => {
      refreshVPNStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [refreshVPNStatus]);

  const handleGetRoutes = async () => {
    try {
      const res = await invoke<GetVPNRoutingTableResponse>("get_vpn_routing_table");
      setVpnRoutes(res.routes);
    } catch (e) {
      console.error(e);
      onError(String(e));
    }
  };

  return (
    <div className={localStyles.container}>
      <div className={`${styles.card} ${localStyles.section}`}>
        <div className={localStyles.headerRow}>
          <Text size={400} weight="semibold">
            VPN 状态
          </Text>
          <span
            className={`${localStyles.statusBadge} ${
              vpnEnabled ? localStyles.statusEnabled : localStyles.statusDisabled
            }`}
          >
            {vpnEnabled ? " 已启用" : " 未启用"}
          </span>
        </div>

        {vpnEnabled && vpnStats ? (
          <>
            {/* VPN Info */}
            <div className={localStyles.horizontalGroup}>
              <div className={localStyles.infoGroup}>
                <Text className={localStyles.infoLabel}>本地 IP</Text>
                <Text className={localStyles.infoValue}>{vpnLocalIp || "无"}</Text>
              </div>
              <div className={localStyles.infoGroup}>
                <Text className={localStyles.infoLabel}>设备</Text>
                <Text className={localStyles.infoValue}>{vpnDeviceName || "无"}</Text>
              </div>
            </div>

            <Divider />

            {/* Stats */}
            <Label>流量统计</Label>
            <div className={localStyles.statsRow}>
              <div className={localStyles.statsCard}>
                <Text
                  className={localStyles.statsNumber}
                  style={{ color: tokens.colorBrandForeground1 }}
                >
                  {vpnStats.packets_sent.toLocaleString()}
                </Text>
                <br />
                <Text className={localStyles.statsLabel}>已发送数据包</Text>
                <br />
                <Text className={localStyles.statsSubLabel}>
                  {formatBytes(vpnStats.bytes_sent)}
                </Text>
              </div>
              <div className={localStyles.statsCard}>
                <Text
                  className={localStyles.statsNumber}
                  style={{ color: tokens.colorPaletteGreenForeground1 }}
                >
                  {vpnStats.packets_received.toLocaleString()}
                </Text>
                <br />
                <Text className={localStyles.statsLabel}>已接收数据包</Text>
                <br />
                <Text className={localStyles.statsSubLabel}>
                  {formatBytes(vpnStats.bytes_received)}
                </Text>
              </div>
              <div className={localStyles.statsCard}>
                <Text
                  className={localStyles.statsNumber}
                  style={{ color: tokens.colorPaletteRedForeground1 }}
                >
                  {vpnStats.packets_dropped.toLocaleString()}
                </Text>
                <br />
                <Text className={localStyles.statsLabel}>已丢弃数据包</Text>
                <br />
                <Text className={localStyles.statsSubLabel}>
                  {vpnStats.packets_sent > 0
                    ? `${((vpnStats.packets_dropped / vpnStats.packets_sent) * 100).toFixed(2)}%`
                    : "0%"}
                </Text>
              </div>
            </div>

            <Divider />

            {/* Routing Table */}
            <div className={localStyles.headerRow}>
              <Label>路由表 ({vpnRoutes.length} 条路由)</Label>
              <Tooltip content="刷新路由" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<ArrowSyncRegular />}
                  onClick={handleGetRoutes}
                />
              </Tooltip>
            </div>
            {vpnRoutes.length > 0 && (
              <Table size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>IP 地址</TableHeaderCell>
                    <TableHeaderCell>名称</TableHeaderCell>
                    <TableHeaderCell>类型</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vpnRoutes.map((route, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Text className={localStyles.monospace}>{ipToString(route.ip)}</Text>
                      </TableCell>
                      <TableCell>{route.name}</TableCell>
                      <TableCell>
                        <Text
                          style={{
                            color: route.is_local
                              ? tokens.colorPaletteGreenForeground1
                              : tokens.colorBrandForeground1,
                          }}
                        >
                          {route.is_local ? "本地" : "远程"}
                        </Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        ) : (
          <div className={localStyles.centerContent}>
            <Text className={localStyles.emptyText}>
              VPN 未启用。加入大厅以启用 VPN。
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
