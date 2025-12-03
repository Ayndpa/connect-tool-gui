import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface CoreStatusResponse {
  is_running: boolean;
  pid: number | null;
  message: string;
}

interface CoreControlResponse {
  success: boolean;
  is_running: boolean;
  pid: number | null;
  message: string;
}

interface CoreVersionResponse {
  version: string;
}

export function useCore() {
  const [isRunning, setIsRunning] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  // Fetch core version
  const fetchVersion = useCallback(async () => {
    try {
      const response = await invoke<CoreVersionResponse>("get_core_version");
      setVersion(response.version);
    } catch (err) {
      // Version fetch failed, likely core not running or not connected
      setVersion(null);
    }
  }, []);

  // Check core status
  const checkStatus = useCallback(async () => {
    try {
      const response = await invoke<CoreStatusResponse>("get_core_status");
      setIsRunning(response.is_running);
      setPid(response.pid);
      setError(null);
      
      // If core is running, try to fetch version
      if (response.is_running) {
        fetchVersion();
      } else {
        setVersion(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchVersion]);

  // Start core
  const startCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await invoke<CoreControlResponse>("start_core");
      if (response.success) {
        setIsRunning(response.is_running);
        setPid(response.pid);
      } else {
        setError(response.message);
        throw new Error(response.message);
      }
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Stop core
  const stopCore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await invoke<CoreControlResponse>("stop_core");
      if (response.success) {
        setIsRunning(false);
        setPid(null);
      } else {
        setError(response.message);
        throw new Error(response.message);
      }
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle core state
  const toggleCore = useCallback(async () => {
    if (isRunning) {
      return await stopCore();
    } else {
      return await startCore();
    }
  }, [isRunning, startCore, stopCore]);

  // Check status on mount and periodically
  useEffect(() => {
    checkStatus();
    
    // Poll for status every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    
    return () => clearInterval(interval);
  }, [checkStatus]);

  return {
    isRunning,
    pid,
    loading,
    error,
    version,
    checkStatus,
    startCore,
    stopCore,
    toggleCore,
  };
}
