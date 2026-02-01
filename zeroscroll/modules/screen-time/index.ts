// Screen Time Module - Expo Modules API for Android UsageStatsManager
import { Platform } from "react-native";

export interface AppUsageStats {
  packageName: string;
  appName: string;
  totalTimeInForeground: number; // milliseconds
  lastTimeUsed: number; // timestamp
}

export interface DailyUsageStats {
  date: string; // YYYY-MM-DD
  apps: AppUsageStats[];
  totalScreenTime: number; // milliseconds
}

interface ScreenTimeModuleType {
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<void>;
  getUsageStats(startTime: number, endTime: number): Promise<AppUsageStats[]>;
  getDailyUsageStats(daysBack: number): Promise<DailyUsageStats[]>;
  getAppUsageToday(packageName: string): Promise<number>;
}

// Try to get the native module using Expo Modules API
let ScreenTimeNative: ScreenTimeModuleType | null = null;

if (Platform.OS === "android") {
  try {
    // Use dynamic require to avoid build errors if module isn't available
    const { requireNativeModule } = require("expo-modules-core");
    ScreenTimeNative = requireNativeModule("ScreenTime");
    console.log("[ScreenTime] Module loaded successfully via Expo Modules");
  } catch (error) {
    console.log("[ScreenTime] Expo module not available, trying NativeModules");
    // Fallback to NativeModules for old architecture
    try {
      const { NativeModules } = require("react-native");
      if (NativeModules.ScreenTimeModule) {
        ScreenTimeNative = NativeModules.ScreenTimeModule;
        console.log("[ScreenTime] Module loaded via NativeModules");
      } else {
        console.log(
          "[ScreenTime] NativeModules.ScreenTimeModule not available",
        );
        console.log(
          "[ScreenTime] Available modules:",
          Object.keys(NativeModules),
        );
      }
    } catch (e) {
      console.log("[ScreenTime] Failed to load from NativeModules:", e);
    }
  }
}

class ScreenTimeModule {
  private isAvailable: boolean;

  constructor() {
    this.isAvailable = ScreenTimeNative !== null;
    console.log("[ScreenTime] isAvailable:", this.isAvailable);
  }

  /**
   * Check if the module is available (Android only)
   */
  isModuleAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Check if the app has usage stats permission
   */
  async hasPermission(): Promise<boolean> {
    if (!this.isAvailable) {
      console.warn("[ScreenTime] Not available on this platform");
      return false;
    }
    try {
      return await ScreenTimeNative!.hasPermission();
    } catch (error) {
      console.error("[ScreenTime] Error checking permission:", error);
      return false;
    }
  }

  /**
   * Request usage stats permission (opens system settings)
   */
  async requestPermission(): Promise<void> {
    if (!this.isAvailable) {
      console.warn("[ScreenTime] Not available on this platform");
      return;
    }
    try {
      await ScreenTimeNative!.requestPermission();
    } catch (error) {
      console.error("[ScreenTime] Error requesting permission:", error);
    }
  }

  /**
   * Get usage stats for a time range
   */
  async getUsageStats(
    startTime: number,
    endTime: number,
  ): Promise<AppUsageStats[]> {
    if (!this.isAvailable) {
      console.warn("[ScreenTime] Not available on this platform");
      return [];
    }
    try {
      return await ScreenTimeNative!.getUsageStats(startTime, endTime);
    } catch (error) {
      console.error("[ScreenTime] Error getting usage stats:", error);
      return [];
    }
  }

  /**
   * Get daily usage stats for the past N days
   */
  async getDailyUsageStats(daysBack: number = 7): Promise<DailyUsageStats[]> {
    if (!this.isAvailable) {
      console.warn("[ScreenTime] Not available on this platform");
      return [];
    }
    try {
      return await ScreenTimeNative!.getDailyUsageStats(daysBack);
    } catch (error) {
      console.error("[ScreenTime] Error getting daily stats:", error);
      return [];
    }
  }

  /**
   * Get today's usage for a specific app
   */
  async getAppUsageToday(packageName: string): Promise<number> {
    if (!this.isAvailable) {
      console.warn("[ScreenTime] Not available on this platform");
      return 0;
    }
    try {
      return await ScreenTimeNative!.getAppUsageToday(packageName);
    } catch (error) {
      console.error("[ScreenTime] Error getting app usage:", error);
      return 0;
    }
  }

  /**
   * Get today's total screen time and top apps
   */
  async getTodayStats(): Promise<{ totalTime: number; apps: AppUsageStats[] }> {
    if (!this.isAvailable) {
      return { totalTime: 0, apps: [] };
    }

    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const apps = await this.getUsageStats(startOfDay.getTime(), now);
    const totalTime = apps.reduce(
      (sum, app) => sum + app.totalTimeInForeground,
      0,
    );

    return { totalTime, apps };
  }

  /**
   * Format milliseconds to human readable time
   */
  formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

// Export singleton instance
export const screenTime = new ScreenTimeModule();

// Export types
export type { ScreenTimeModuleType };

// Default export
export default screenTime;
