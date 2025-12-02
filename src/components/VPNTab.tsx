import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Stack,
  Text,
  Separator,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
  Label,
  IconButton,
  ProgressIndicator,
} from "@fluentui/react";
import { cardStyles, sectionStackTokens, containerStackTokens, statsCardClass } from "../styles";
import { ipToString, formatBytes } from "../utils/helpers";
import { VPNStats, VPNRoute, GetVPNStatusResponse, GetVPNRoutingTableResponse } from "../types";

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

  const routeColumns: IColumn[] = [
    {
      key: "ip",
      name: "IP 地址",
      minWidth: 120,
      onRender: (item: VPNRoute) => <Text style={{ fontFamily: "monospace" }}>{ipToString(item.ip)}</Text>,
    },
    { key: "name", name: "名称", fieldName: "name", minWidth: 150 },
    {
      key: "is_local",
      name: "类型",
      minWidth: 80,
      onRender: (item: VPNRoute) => (
        <Text style={{ color: item.is_local ? "#107c10" : "#0078d4" }}>{item.is_local ? "本地" : "远程"}</Text>
      ),
    },
  ];

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
    <Stack tokens={containerStackTokens} styles={{ root: { marginTop: 16 } }}>
      <Stack styles={cardStyles} tokens={sectionStackTokens}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
            VPN 状态
          </Text>
          <Text
            styles={{
              root: {
                padding: "4px 12px",
                borderRadius: 12,
                backgroundColor: vpnEnabled ? "#dff6dd" : "#f3f2f1",
                color: vpnEnabled ? "#107c10" : "#605e5c",
              },
            }}
          >
            {vpnEnabled ? " 已启用" : " 未启用"}
          </Text>
        </Stack>

        {vpnEnabled && vpnStats ? (
          <>
            {/* VPN Info */}
            <Stack horizontal tokens={{ childrenGap: 32 }}>
              <Stack>
                <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                  本地 IP
                </Text>
                <Text styles={{ root: { fontFamily: "monospace", fontWeight: 600 } }}>{vpnLocalIp || "无"}</Text>
              </Stack>
              <Stack>
                <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                  设备
                </Text>
                <Text styles={{ root: { fontFamily: "monospace", fontWeight: 600 } }}>{vpnDeviceName || "无"}</Text>
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
                <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                  已发送数据包
                </Text>
                <Text variant="tiny" styles={{ root: { color: "#a19f9d" } }}>
                  {formatBytes(vpnStats.bytes_sent)}
                </Text>
              </div>
              <div className={statsCardClass} style={{ flex: 1 }}>
                <Text variant="xxLarge" styles={{ root: { fontWeight: 600, color: "#107c10" } }}>
                  {vpnStats.packets_received.toLocaleString()}
                </Text>
                <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                  已接收数据包
                </Text>
                <Text variant="tiny" styles={{ root: { color: "#a19f9d" } }}>
                  {formatBytes(vpnStats.bytes_received)}
                </Text>
              </div>
              <div className={statsCardClass} style={{ flex: 1 }}>
                <Text variant="xxLarge" styles={{ root: { fontWeight: 600, color: "#d13438" } }}>
                  {vpnStats.packets_dropped.toLocaleString()}
                </Text>
                <Text variant="small" styles={{ root: { color: "#605e5c" } }}>
                  已丢弃
                </Text>
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
              <IconButton iconProps={{ iconName: "Refresh" }} onClick={handleGetRoutes} title="刷新路由" />
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
            <Text styles={{ root: { color: "#605e5c" } }}>VPN 未启用。加入大厅以启用 VPN。</Text>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
