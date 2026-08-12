import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// 关键：target 必须低于 ES2020（即 es2019 或更低）
// ?. 可选链和 ?? 空值合并是 ES2020 语法，Chrome 80+ 才支持
// 如果 target 设为 chrome80，esbuild 不会转译 ?. ——旧车机 WebView 仍报错
// 用 es2019 强制 esbuild 把 ?. 和 ?? 转译为等价 ES2019 写法
// beforeBuildCommand 有时未注入 TAURI_ENV_PLATFORM，故不依赖该变量

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'MP3Freer2',
        short_name: 'MP3Freer2',
        description: 'MP3 Player & Music Client',
        theme_color: '#1a1824',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],

  // esbuild 预构建 + 源码转换阶段的目标
  esbuild: {
    target: "es2019",
  },

  // 多入口：主窗口 + 桌面歌词悬浮窗
  build: {
    target: "es2019",
    cssTarget: "es2019",
    rollupOptions: {
      input: {
        main: "index.html",
        lyricOverlay: "lyric-overlay.html",
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
