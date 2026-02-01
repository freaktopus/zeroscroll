import { useState, useEffect, useCallback, useRef } from "react";
import {
  screenTime,
  AppUsageStats,
  DailyUsageStats,
} from "@/modules/screen-time";

export interface UseScreenTimeResult {
  isModuleAvailable: boolean;
  hasPermission: boolean;
  isLoading: boolean;
  totalScreenTimeToday: number;
  todayStats: AppUsageStats[];
  weeklyStats: DailyUsageStats[];
  requestPermission: () => Promise<void>;
  refresh: () => Promise<void>;
  getAppUsage: (packageName: string) => Promise<number>;
  formatDuration: (ms: number) => string;
}

export function useScreenTime(): UseScreenTimeResult {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [totalScreenTimeToday, setTotalScreenTimeToday] = useState(0);
  const [todayStats, setTodayStats] = useState<AppUsageStats[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<DailyUsageStats[]>([]);
  const hasFetched = useRef(false);

  const checkPermission = useCallback(async () => {
    if (!screenTime.isModuleAvailable()) return false;
    const permitted = await screenTime.hasPermission();
    setHasPermission(permitted);
    return permitted;
  }, []);

  const fetchStats = useCallback(async () => {
    if (!screenTime.isModuleAvailable()) {
      console.log("[useScreenTime] Module not available");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const permitted = await checkPermission();
      if (!permitted) {
        console.log("[useScreenTime] No permission");
        setIsLoading(false);
        return;
      }

      // Get today's stats
      const now = Date.now();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      console.log(
        `[useScreenTime] Fetching stats from ${startOfDay.toISOString()} to now`,
      );

      const today = await screenTime.getUsageStats(startOfDay.getTime(), now);

      console.log(
        `[useScreenTime] Raw today stats:`,
        today
          .slice(0, 5)
          .map(
            (a) =>
              `${a.appName}: ${Math.round(a.totalTimeInForeground / 60000)}m`,
          ),
      );

      setTodayStats(today);

      // Calculate total
      const total = today.reduce(
        (sum, app) => sum + app.totalTimeInForeground,
        0,
      );
      setTotalScreenTimeToday(total);

      // Get weekly stats
      const weekly = await screenTime.getDailyUsageStats(7);
      setWeeklyStats(weekly);

      console.log(
        `[useScreenTime] Today: ${screenTime.formatDuration(total)}, Apps: ${today.length}`,
      );
    } catch (error) {
      console.error("[useScreenTime] Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [checkPermission]);

  const requestPermission = useCallback(async () => {
    await screenTime.requestPermission();
    // Check permission after a delay (user needs to toggle setting)
    setTimeout(async () => {
      await checkPermission();
      await fetchStats();
    }, 1000);
  }, [checkPermission, fetchStats]);

  const getAppUsage = useCallback(async (packageName: string) => {
    return await screenTime.getAppUsageToday(packageName);
  }, []);

  // Initial load - only once
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchStats();
    }
  }, [fetchStats]);

  return {
    isModuleAvailable: screenTime.isModuleAvailable(),
    hasPermission,
    isLoading,
    totalScreenTimeToday,
    todayStats,
    weeklyStats,
    requestPermission,
    refresh: fetchStats,
    getAppUsage,
    formatDuration: screenTime.formatDuration.bind(screenTime),
  };
}

export default useScreenTime;
