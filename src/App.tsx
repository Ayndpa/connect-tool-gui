import { useState } from "react";
import {
  Stack,
  MessageBar,
  MessageBarType,
  ThemeProvider,
  initializeIcons,
  Pivot,
  PivotItem,
} from "@fluentui/react";
import { mainStyles, containerStackTokens } from "./styles";
import { AppHeader, LobbyTab, VPNTab, SteamChinaTab } from "./components";

// Initialize icons
initializeIcons();

function App() {
  // Global state for notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Status indicators for header
  const [steamInitialized, setSteamInitialized] = useState(false);
  const [vpnEnabled, setVpnEnabled] = useState(false);

  const handleSteamStatusChange = (initialized: boolean) => {
    setSteamInitialized(initialized);
  };

  const handleVpnStatusChange = (enabled: boolean) => {
    setVpnEnabled(enabled);
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
    <ThemeProvider>
      <Stack styles={mainStyles} tokens={containerStackTokens}>
        {/* Header */}
        <AppHeader steamInitialized={steamInitialized} vpnEnabled={vpnEnabled} />

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

        <Pivot aria-label="主导航">
          <PivotItem headerText="大厅" itemIcon="Group">
            <LobbyTab 
              onError={handleError} 
              onSuccess={showSuccess} 
              onSteamStatusChange={handleSteamStatusChange}
            />
          </PivotItem>

          <PivotItem headerText="VPN" itemIcon="Shield">
            <VPNTab onError={handleError} onVpnStatusChange={handleVpnStatusChange} />
          </PivotItem>

          <PivotItem headerText="Steam 中国区" itemIcon="Globe">
            <SteamChinaTab onError={handleError} onSuccess={showSuccess} />
          </PivotItem>
        </Pivot>
      </Stack>
    </ThemeProvider>
  );
}

export default App;
