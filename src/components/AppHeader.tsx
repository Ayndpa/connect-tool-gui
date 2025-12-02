import { Stack, Text } from "@fluentui/react";
import { headerClass } from "../styles";

interface AppHeaderProps {
  vpnEnabled: boolean;
}

export function AppHeader({ vpnEnabled }: AppHeaderProps) {
  return (
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
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: vpnEnabled ? "#92c353" : "#c8c6c4",
              }}
            />
            <Text styles={{ root: { color: "rgba(255,255,255,0.9)", fontSize: 12 } }}>VPN</Text>
          </Stack>
        </Stack>
      </Stack>
    </div>
  );
}
