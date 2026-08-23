package com.rog.mp3freer

import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.ServiceCompat

class MediaPlaybackService : Service() {
    companion object {
        const val NOTIFICATION_ID = 10086
        const val ACTION_START = "com.rog.mp3freer.service.START"
        const val ACTION_STOP = "com.rog.mp3freer.service.STOP"
        private var latestNotification: Notification? = null

        fun start(context: Context, notification: Notification) {
            latestNotification = notification
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_START
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (_: Throwable) {}
        }

        fun update(context: Context, notification: Notification) {
            latestNotification = notification
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_START
            }
            try {
                context.startService(intent)
            } catch (_: Throwable) {}
        }

        fun stop(context: Context) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_STOP
            }
            try {
                context.startService(intent)
            } catch (_: Throwable) {}
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        acquireLocks()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                latestNotification?.let { notif ->
                    try {
                        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                        } else {
                            0
                        }
                        ServiceCompat.startForeground(this, NOTIFICATION_ID, notif, type)
                    } catch (_: Throwable) {
                        try {
                            @Suppress("DEPRECATION")
                            startForeground(NOTIFICATION_ID, notif)
                        } catch (_: Throwable) {}
                    }
                }
                acquireLocks()
            }
            ACTION_STOP -> {
                releaseLocks()
                try {
                    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
                } catch (_: Throwable) {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun acquireLocks() {
        try {
            if (wakeLock == null) {
                val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
                wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MP3Freer::ServiceWakeLock")?.apply {
                    setReferenceCounted(false)
                }
            }
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire(24 * 60 * 60 * 1000L)
            }

            if (wifiLock == null) {
                val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                val lockType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                } else {
                    @Suppress("DEPRECATION")
                    WifiManager.WIFI_MODE_FULL
                }
                wifiLock = wm?.createWifiLock(lockType, "MP3Freer::ServiceWifiLock")?.apply {
                    setReferenceCounted(false)
                }
            }
            if (wifiLock?.isHeld == false) {
                wifiLock?.acquire()
            }
        } catch (_: Throwable) {}
    }

    private fun releaseLocks() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
            if (wifiLock?.isHeld == true) wifiLock?.release()
        } catch (_: Throwable) {}
    }

    override fun onDestroy() {
        releaseLocks()
        super.onDestroy()
    }
}