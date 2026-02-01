package expo.modules.screentime

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar
import java.util.Locale

class ScreenTimeModule : Module() {
    private val context: Context
        get() = requireNotNull(appContext.reactContext)

    private val usageStatsManager: UsageStatsManager
        get() = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    private val packageManager
        get() = context.packageManager

    override fun definition() = ModuleDefinition {
        Name("ScreenTime")

        AsyncFunction("hasPermission") {
            val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.packageName
                )
            } else {
                @Suppress("DEPRECATION")
                appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.packageName
                )
            }
            mode == AppOpsManager.MODE_ALLOWED
        }

        AsyncFunction("requestPermission") {
            // First, try to query usage stats - this registers our app in the Usage Access list
            try {
                val endTime = System.currentTimeMillis()
                val startTime = endTime - 1000 * 60 * 60 * 24 * 7 // 7 days ago
                usageStatsManager.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY,
                    startTime,
                    endTime
                )
            } catch (e: Exception) {
                // Ignore - we just want to register the app
            }
            
            var opened = false
            
            // Try Samsung-specific Special Access settings first
            if (!opened) {
                try {
                    val intent = Intent()
                    intent.setClassName("com.android.settings", "com.android.settings.Settings\$UsageAccessSettingsActivity")
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    opened = true
                } catch (e: Exception) {
                    // Not Samsung or activity not found
                }
            }
            
            // Try standard ACTION_USAGE_ACCESS_SETTINGS
            if (!opened) {
                try {
                    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    opened = true
                } catch (e: Exception) {
                    // Fall through
                }
            }
            
            // Last resort - open app details settings
            if (!opened) {
                try {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    intent.data = android.net.Uri.parse("package:${context.packageName}")
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    opened = true
                } catch (e2: Exception) {
                    // Give up
                }
            }
            opened
        }

        AsyncFunction("getUsageStats") { startTime: Double, endTime: Double ->
            // Use queryEvents for accurate real-time usage tracking
            val events = usageStatsManager.queryEvents(startTime.toLong(), endTime.toLong())
            
            // Track foreground time using events
            val foregroundTimes = mutableMapOf<String, Long>()
            val lastForegroundStart = mutableMapOf<String, Long>()
            val lastUsedTimes = mutableMapOf<String, Long>()
            
            val event = android.app.usage.UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                val pkg = event.packageName
                
                when (event.eventType) {
                    android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED,
                    android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                        // App came to foreground
                        lastForegroundStart[pkg] = event.timeStamp
                        if ((lastUsedTimes[pkg] ?: 0L) < event.timeStamp) {
                            lastUsedTimes[pkg] = event.timeStamp
                        }
                    }
                    android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED,
                    android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                        // App went to background
                        val startTs = lastForegroundStart[pkg]
                        if (startTs != null && startTs > 0) {
                            val duration = event.timeStamp - startTs
                            if (duration > 0) {
                                foregroundTimes[pkg] = (foregroundTimes[pkg] ?: 0L) + duration
                            }
                            lastForegroundStart.remove(pkg)
                        }
                        if ((lastUsedTimes[pkg] ?: 0L) < event.timeStamp) {
                            lastUsedTimes[pkg] = event.timeStamp
                        }
                    }
                }
            }
            
            // Account for apps still in foreground (add time from last start to now)
            val now = System.currentTimeMillis()
            for ((pkg, startTs) in lastForegroundStart) {
                if (startTs > 0 && startTs < now) {
                    val duration = now - startTs
                    foregroundTimes[pkg] = (foregroundTimes[pkg] ?: 0L) + duration
                    lastUsedTimes[pkg] = now
                }
            }

            // Filter out system apps (but keep our own app)
            val filteredPackages = foregroundTimes.keys.filter { pkg ->
                !isSystemApp(pkg) || pkg == context.packageName
            }

            filteredPackages.sortedByDescending { foregroundTimes[it] ?: 0L }.map { pkg ->
                mapOf(
                    "packageName" to pkg,
                    "appName" to getAppName(pkg),
                    "totalTimeInForeground" to (foregroundTimes[pkg] ?: 0L).toDouble(),
                    "lastTimeUsed" to (lastUsedTimes[pkg] ?: 0L).toDouble()
                )
            }
        }

        AsyncFunction("getDailyUsageStats") { daysBack: Int ->
            val result = mutableListOf<Map<String, Any>>()
            val calendar = Calendar.getInstance()

            for (i in 0 until daysBack) {
                calendar.set(Calendar.HOUR_OF_DAY, 0)
                calendar.set(Calendar.MINUTE, 0)
                calendar.set(Calendar.SECOND, 0)
                calendar.set(Calendar.MILLISECOND, 0)

                val startTime = calendar.timeInMillis
                val endTime = calendar.timeInMillis + 24 * 60 * 60 * 1000 - 1

                val stats = usageStatsManager.queryUsageStats(
                    UsageStatsManager.INTERVAL_BEST,
                    startTime,
                    endTime
                )

                val dateStr = String.format(
                    Locale.US,
                    "%04d-%02d-%02d",
                    calendar.get(Calendar.YEAR),
                    calendar.get(Calendar.MONTH) + 1,
                    calendar.get(Calendar.DAY_OF_MONTH)
                )

                // Aggregate stats by package name
                val aggregatedStats = mutableMapOf<String, Long>()
                val lastUsedTimes = mutableMapOf<String, Long>()
                
                stats?.forEach { stat ->
                    if (stat.totalTimeInForeground > 0) {
                        val pkg = stat.packageName
                        aggregatedStats[pkg] = (aggregatedStats[pkg] ?: 0L) + stat.totalTimeInForeground
                        val currentLastUsed = lastUsedTimes[pkg] ?: 0L
                        if (stat.lastTimeUsed > currentLastUsed) {
                            lastUsedTimes[pkg] = stat.lastTimeUsed
                        }
                    }
                }

                // Filter out system apps
                val filteredPackages = aggregatedStats.keys.filter { pkg ->
                    !isSystemApp(pkg) || pkg == context.packageName
                }

                var totalTime = 0L
                val apps = mutableListOf<Map<String, Any>>()

                for (pkg in filteredPackages.sortedByDescending { aggregatedStats[it] ?: 0L }) {
                    val time = aggregatedStats[pkg] ?: 0L
                    apps.add(mapOf(
                        "packageName" to pkg,
                        "appName" to getAppName(pkg),
                        "totalTimeInForeground" to time.toDouble(),
                        "lastTimeUsed" to (lastUsedTimes[pkg] ?: 0L).toDouble()
                    ))
                    totalTime += time
                }

                result.add(mapOf(
                    "date" to dateStr,
                    "apps" to apps,
                    "totalScreenTime" to totalTime.toDouble()
                ))

                calendar.add(Calendar.DAY_OF_YEAR, -1)
            }

            result
        }

        AsyncFunction("getAppUsageToday") { packageName: String ->
            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)

            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            // Use queryEvents for accurate real-time tracking (same as getUsageStats)
            val events = usageStatsManager.queryEvents(startTime, endTime)
            
            var totalForegroundTime = 0L
            var lastForegroundStart = 0L
            
            val event = android.app.usage.UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                
                // Only process events for the requested package
                if (event.packageName != packageName) continue
                
                when (event.eventType) {
                    android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED,
                    android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                        // App came to foreground
                        lastForegroundStart = event.timeStamp
                    }
                    android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED,
                    android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                        // App went to background
                        if (lastForegroundStart > 0) {
                            val duration = event.timeStamp - lastForegroundStart
                            if (duration > 0) {
                                totalForegroundTime += duration
                            }
                            lastForegroundStart = 0L
                        }
                    }
                }
            }
            
            // If app is still in foreground, add time from last start to now
            if (lastForegroundStart > 0) {
                val duration = System.currentTimeMillis() - lastForegroundStart
                if (duration > 0) {
                    totalForegroundTime += duration
                }
            }

            totalForegroundTime.toDouble()
        }
    }

    private fun isSystemApp(packageName: String): Boolean {
        // Only filter out core Android system apps
        val coreSystemPackages = listOf(
            "com.android.systemui",
            "com.android.launcher",
            "com.android.settings",
            "com.android.vending", // Google Play Store
            "com.google.android.gms", // Google Play Services
            "com.google.android.gsf", // Google Services Framework
            "android"
        )
        
        if (coreSystemPackages.any { packageName.startsWith(it) }) {
            return true
        }
        
        return try {
            val appInfo = packageManager.getApplicationInfo(packageName, 0)
            // Only filter if it's a system app AND doesn't have a launcher icon
            val isSystem = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
            val hasLauncher = packageManager.getLaunchIntentForPackage(packageName) != null
            isSystem && !hasLauncher
        } catch (e: Exception) {
            false // If we can't get info, show it anyway
        }
    }

    private fun getAppName(packageName: String): String {
        return try {
            val appInfo = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            packageName
        }
    }
}
