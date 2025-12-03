import { useState, useEffect } from "react";
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  MessageBar,
  MessageBarBody,
  MessageBarActions,
  Button,
  TabList,
  Tab,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  GroupRegular,
  ShieldRegular,
  GlobeRegular,
  DismissRegular,
  ShieldCheckmarkRegular,
} from "@fluentui/react-icons";
import { useStyles as useGlobalStyles, containerGap } from "./styles";
import { AppHeader, LobbyTab, VPNTab, SteamChinaTab, FirewallTab } from "./components";
import { useTheme, useCore } from "./hooks";

const useAppStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: containerGap,
  },
});

function App() {
  // Global state for notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("lobby");

  // Status indicators for header
  const [vpnEnabled, setVpnEnabled] = useState(false);

  // Theme management
  const { isDark, themeMode, toggleTheme } = useTheme();
  const currentTheme = isDark ? webDarkTheme : webLightTheme;

  // Core management
  const { isRunning: coreRunning, loading: coreLoading, toggleCore, startCore, stopCore, error: coreError, version: coreVersion } = useCore();

  const styles = useGlobalStyles();
  const appStyles = useAppStyles();

  // 软件启动时自动尝试启动核心
  useEffect(() => {
    const autoStartCore = async () => {
      try {
        await startCore();
      } catch (err) {
        // 启动失败时通知用户
        const errorMsg = err instanceof Error ? err.message : String(err);
        setErrorMsg(`核心服务自动启动失败: ${errorMsg}`);
        setTimeout(() => setErrorMsg(null), 5000);
      }
    };
    autoStartCore();
  }, [startCore]);

  // 动态设置背景色以支持主题切换
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      root.style.backgroundColor = tokens.colorNeutralBackground2;
    }
    return () => {
      const root = document.getElementById("root");
      if (root) {
        root.style.backgroundColor = "";
      }
    };
  }, []);

  const handleVpnStatusChange = (enabled: boolean) => {
    setVpnEnabled(enabled);
  };

  const handleToggleCore = async () => {
    try {
      await toggleCore();
      if (!coreRunning) {
        showSuccess("核心服务已启动");
      } else {
        showSuccess("核心服务已停止");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      handleError(errorMsg || coreError || "核心服务操作失败");
    }
  };

  const handleError = (msg: string) => {
    console.error(msg);
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <FluentProvider theme={currentTheme} style={{ height: "100%" }}>
      <div className={styles.wrapper}>
      <div className={`${styles.main} ${appStyles.container}`}>
        {/* Header */}
        <AppHeader 
          vpnEnabled={vpnEnabled} 
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          coreRunning={coreRunning}
          coreLoading={coreLoading}
          coreVersion={coreVersion}
          onToggleCore={handleToggleCore}
        />

        {/* Notifications */}
        {errorMsg && (
          <MessageBar intent="error">
            <MessageBarBody>{errorMsg}</MessageBarBody>
            <MessageBarActions>
              <Button
                appearance="transparent"
                icon={<DismissRegular />}
                onClick={() => setErrorMsg(null)}
              />
            </MessageBarActions>
          </MessageBar>
        )}
        {successMsg && (
          <MessageBar intent="success">
            <MessageBarBody>{successMsg}</MessageBarBody>
            <MessageBarActions>
              <Button
                appearance="transparent"
                icon={<DismissRegular />}
                onClick={() => setSuccessMsg(null)}
              />
            </MessageBarActions>
          </MessageBar>
        )}

        <TabList
          selectedValue={selectedTab}
          onTabSelect={(_, data) => setSelectedTab(data.value as string)}
        >
          <Tab value="lobby" icon={<GroupRegular />}>
            大厅
          </Tab>
          <Tab value="vpn" icon={<ShieldRegular />}>
            VPN
          </Tab>
          <Tab value="steamchina" icon={<GlobeRegular />}>
            Steam 中国区
          </Tab>
          <Tab value="firewall" icon={<ShieldCheckmarkRegular />}>
            防火墙
          </Tab>
        </TabList>

        {selectedTab === "lobby" && (
          <LobbyTab onError={handleError} onSuccess={showSuccess} />
        )}
        {selectedTab === "vpn" && (
          <VPNTab onError={handleError} onVpnStatusChange={handleVpnStatusChange} />
        )}
        {selectedTab === "steamchina" && (
          <SteamChinaTab 
            onError={handleError} 
            onSuccess={showSuccess}
            coreRunning={coreRunning}
            onStopCore={stopCore}
          />
        )}
        {selectedTab === "firewall" && (
          <FirewallTab onError={handleError} onSuccess={showSuccess} />
        )}
      </div>
      </div>
    </FluentProvider>
  );
}

export default App;
