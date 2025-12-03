import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "app-theme-mode";

export function useTheme() {
  // 获取系统偏好的深色模式
  const getSystemPrefersDark = useCallback(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, []);

  // 从 localStorage 读取保存的主题设置
  const getSavedThemeMode = useCallback((): ThemeMode => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return "system";
  }, []);

  const [themeMode, setThemeMode] = useState<ThemeMode>(getSavedThemeMode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // 保存主题设置到 localStorage
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  // 计算实际的深色模式状态
  const isDark = themeMode === "system" ? systemPrefersDark : themeMode === "dark";

  // 切换主题模式
  const toggleTheme = useCallback(() => {
    setThemeMode((current) => {
      if (current === "system") return "light";
      if (current === "light") return "dark";
      return "system";
    });
  }, []);

  // 设置特定主题模式
  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
  }, []);

  return {
    themeMode,
    isDark,
    systemPrefersDark,
    toggleTheme,
    setTheme,
  };
}
