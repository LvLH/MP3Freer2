package com.rog.mp3freer

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // 不用 edge-to-edge：部分车机 insets 异常会导致内容区不可见
    super.onCreate(savedInstanceState)

    try {
      WebView.setWebContentsDebuggingEnabled(true)
    } catch (_: Throwable) {
      // ignore
    }

    // 开启 GPU 硬件加速（支持 60~120Hz 高刷新率丝滑渲染）；配置媒体后台流畅播放
    Handler(Looper.getMainLooper()).postDelayed({
      val wv = findWebView(window.decorView) ?: return@postDelayed
      wv.setBackgroundColor(0xFF0F0A1A.toInt())
      wv.setLayerType(View.LAYER_TYPE_HARDWARE, null)
      try {
        wv.settings.mediaPlaybackRequiresUserGesture = false
        wv.settings.domStorageEnabled = true
        wv.settings.databaseEnabled = true
        wv.settings.setNeedInitialFocus(false)
      } catch (_: Throwable) {
        // ignore
      }
    }, 100)
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        val found = findWebView(view.getChildAt(i))
        if (found != null) return found
      }
    }
    return null
  }
}
