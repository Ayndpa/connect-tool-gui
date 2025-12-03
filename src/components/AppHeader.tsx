import { Text, Button, Tooltip, makeStyles, tokens, Spinner } from "@fluentui/react-components";
import {
  WeatherMoonRegular,
  WeatherSunnyRegular,
  DesktopRegular,
  PlayRegular,
  StopRegular,
} from "@fluentui/react-icons";
import type { ThemeMode } from "../hooks";

const useStyles = makeStyles({
  header: {
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorBrandBackgroundPressed} 100%)`,
    padding: "20px 24px",
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: "16px",
  },
  container: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleGroup: {
    display: "flex",
    flexDirection: "column",
  },
  title: {
    color: "white",
    fontWeight: 600,
    fontSize: tokens.fontSizeBase500,
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: tokens.fontSizeBase200,
  },
  statusGroup: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
  },
  statusItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  statusLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: tokens.fontSizeBase200,
  },
  themeButton: {
    color: "white",
    minWidth: "auto",
    "&:hover": {
      backgroundColor: "rgba(255,255,255,0.1)",
      color: "white",
    },
  },
  coreButton: {
    color: "white",
    minWidth: "auto",
    "&:hover": {
      backgroundColor: "rgba(255,255,255,0.1)",
      color: "white",
    },
  },
});

interface AppHeaderProps {
  vpnEnabled: boolean;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  coreRunning: boolean;
  coreLoading: boolean;
  coreVersion: string | null;
  onToggleCore: () => void;
}

const themeModeLabels: Record<ThemeMode, string> = {
  system: "跟随系统",
  light: "浅色模式",
  dark: "深色模式",
};

const ThemeIcon = ({ mode }: { mode: ThemeMode }) => {
  switch (mode) {
    case "light":
      return <WeatherSunnyRegular />;
    case "dark":
      return <WeatherMoonRegular />;
    default:
      return <DesktopRegular />;
  }
};

export function AppHeader({ 
  vpnEnabled, 
  themeMode, 
  onToggleTheme,
  coreRunning,
  coreLoading,
  coreVersion,
  onToggleCore
}: AppHeaderProps) {
  const styles = useStyles();

  return (
    <div className={styles.header}>
      <div className={styles.container}>
        <div className={styles.titleGroup}>
          <Text className={styles.title}>连接工具</Text>
          <Text className={styles.subtitle}>Steam 网络 & VPN 管理器</Text>
        </div>
        <div className={styles.statusGroup}>
          {/* Core Status */}
          <div className={styles.statusItem}>
            <div
              className={styles.statusDot}
              style={{ backgroundColor: coreRunning ? "#92c353" : "#c8c6c4" }}
            />
            <Text className={styles.statusLabel}>
              核心{coreVersion ? ` v${coreVersion}` : ""}
            </Text>
            <Tooltip content={coreRunning ? "停止核心" : "启动核心"} relationship="label">
              <Button
                appearance="transparent"
                className={styles.coreButton}
                icon={coreLoading ? <Spinner size="tiny" /> : (coreRunning ? <StopRegular /> : <PlayRegular />)}
                onClick={onToggleCore}
                disabled={coreLoading}
              />
            </Tooltip>
          </div>
          
          <div className={styles.statusItem}>
            <div
              className={styles.statusDot}
              style={{ backgroundColor: vpnEnabled ? "#92c353" : "#c8c6c4" }}
            />
            <Text className={styles.statusLabel}>VPN</Text>
          </div>
          <Tooltip content={themeModeLabels[themeMode]} relationship="label">
            <Button
              appearance="transparent"
              className={styles.themeButton}
              icon={<ThemeIcon mode={themeMode} />}
              onClick={onToggleTheme}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
