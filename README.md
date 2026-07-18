# MP3Freer

> 基于 Tauri v2 + React 19 的本地与在线音乐播放器。聚合多平台在线搜索、本地音乐管理、歌词与翻译、桌面歌词、智能歌单和播放历史，全部打包进一个轻量原生桌面应用。

当前版本：`v26.7.17`

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [构建产出](#构建产出)
- [快捷键一览](#快捷键一览)
- [配置说明](#配置说明)
- [项目结构](#项目结构)
- [参与贡献](#参与贡献)
- [免责声明](#免责声明)
- [开源协议](#开源协议)

---

## 功能特性

- **多平台在线搜索**：网易云音乐、QQ 音乐、酷狗、酷我、咪咕五平台聚合搜索，可在设置中切换默认搜索源。
- **多音质播放**：标准 128k / 高品 320k / 无损 FLAC / Hi-Res 四档音质可选，按歌曲本身可用源自动适配。
- **本地音乐管理**：导入本地文件夹，自动解析音频元数据（Rust 侧下沉解析，带进度下载），与在线内容统一展示。
- **歌词与翻译**：双语歌词、罗马音、± 校时偏移，全屏沉浸式歌词视图（黑胶唱片 + 虚化背景 + 平滑滚动）。
- **桌面歌词**：独立置顶透明窗口，拖拽移动，右键菜单控制，可与主窗分离显示。
- **收藏与下载**：一键收藏在线歌曲，自动下载音频和歌词到指定目录；收藏列表支持本周最爱上榜。
- **智能歌单**：智能歌单面板，按听歌习惯和年份生成推荐与年度报告。
- **播放历史**：完整播放历史记录，最近 / 本周最爱排行。
- **系统托盘**：托盘图标 + 右键菜单（播放/暂停、上一曲、下一曲、停止），托盘点击与全局媒体键联动。
- **跨平台数据隔离**：播放进度、时长、播放态走独立外部 store（`useSyncExternalStore`），高频更新不触发全局重渲染。
- **第三方 API 节点回退**：多节点自动顺延重试，单点失败不影响播放。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面外壳 | Tauri v2（Rust 后端） |
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 7 |
| 状态管理 | Context + `useSyncExternalStore` 外部 store |
| 图标 | lucide-react |
| HTTP | `@tauri-apps/plugin-http`（绕浏览器 CORS 限制） |

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust](https://www.rust-lang.org/tools/install)（稳定版工具链）
- [Tauri v2 前置依赖](https://tauri.app/start/prerequisites/)（Windows 需要 WebView2 与 MSVC 构建工具）

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

热重载开发，Vite 跑在 `http://localhost:1420`，Tauri 外壳加载该地址。

### 生产构建

```bash
npm run tauri build
```

产物在 `src-tauri/target/release/bundle/` 下。Windows 上会生成 `.exe` 安装包与 `.msi`。

### 仅前端 / 类型检查

```bash
npm run build      # tsc 类型检查 + vite 构建
npm run dev        # 仅前端 dev server（无 Tauri 外壳，部分原生能力不可用）
```

## 构建产出

| 平台 | 产物路径 |
| --- | --- |
| Windows | `src-tauri/target/release/bundle/{nsis,msi}/` |
| macOS | `src-tauri/target/release/bundle/{dmg,app}/` |
| Linux | `src-tauri/target/release/bundle/{deb,appimage}/` |

## 快捷键一览

> 应用窗口聚焦时生效。在输入框 / 可编辑区域内的按键会被忽略以避免冲突。

| 快捷键 | 动作 |
| --- | --- |
| `Space` | 播放 / 暂停 |
| `Ctrl` / `Cmd` / `Alt` + `←` | 上一曲 |
| `Ctrl` / `Cmd` / `Alt` + `→` | 下一曲 |
| `Ctrl` / `Cmd` / `Alt` + `↑` | 音量 +5% |
| `Ctrl` / `Cmd` / `Alt` + `↓` | 音量 −5% |
| `M` | 静音 / 取消静音 |
| `L` | 切换当前播放列表 |
| `Enter` | 切换全屏歌词 |
| `O` / `R` / `P` | 切换播放模式 |
| `Ctrl` / `Cmd` + `F` | 聚焦搜索框 |
| `?` / `F1` | 帮助 |

**全局媒体键 / 系统托盘菜单**（应用失焦时同样有效）：

| 动作 | 命令 |
| --- | --- |
| 播放/暂停 | `play-pause` |
| 上一曲 | `prev` |
| 下一曲 | `next` |
| 停止（回到开头） | `stop` |
| 音量增 / 减 / 静音 | `volume-up` / `volume-down` / `volume-mute` |

> 托盘点击和全局媒体键通过 Tauri `system-action` 事件路由到前端，自带 400ms 动作去抖，防止端到端多重派发导致的「播放→暂停→播放」反复横跳。

## 配置说明

所有配置项存储在浏览器 `localStorage`，可在应用内「关于 / 设置」面板调整：

| 配置 | localStorage key | 默认值 |
| --- | --- | --- |
| 收藏下载目录 | `mp3freer_download_path` | `C:\Users\Public\Downloads` |
| 默认搜索平台 | `mp3freer_default_search_source` | `netease` |
| 播放音质 | `mp3freer_preferred_quality` | `high`（320k） |
| 启用的第三方 API 节点 | `mp3freer_enabled_api_endpoints` | 全部启用 |
| 代理 URL | `mp3freer_proxy_url` | 空 |

启用的节点会按顺序尝试，任一节点请求失败自动顺延到下一个。

内置第三方节点（可在设置中开关）：

- `https://music-api.gdstudio.xyz`
- `https://api.xingzhige.com`

## 项目结构

```text
MP3Freer2/
├── src/                      # 前端
│   ├── components/           # 各功能面板与视图
│   ├── context/              # PlayerContext / ToastContext
│   ├── hooks/                # useShortcuts 等
│   ├── services/             # musicApi / rustBridge / storage / playbackProgress
│   ├── entries/               # 桌面歌词独立窗口入口
│   ├── utils/                # 歌词解析 / 默认封面 / 报告统计 / 智能歌单
│   └── settings.ts           # 版本与全部配置项单一来源
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── lib.rs            # 应用入口与事件路由
│   │   ├── commands.rs       # Tauri 命令
│   │   └── system_integration.rs  # 托盘 / 全局媒体键 / 系统集成
│   ├── capabilities/         # Tauri v2 权限声明
│   └── tauri.conf.json       # 主窗口 + 桌面歌词窗口配置
├── lyric-overlay.html        # 桌面歌词窗口 HTML 入口
├── package.json
└── LICENSE
```

## 参与贡献

欢迎 issue 和 PR。提 PR 前请注意：

1. **先开 issue 讨论**：较大改动（新功能、重构、权限变更）请先开 issue 说明动机和方案，避免做无用功。
2. **分支**：基于 `main` 拉分支，命名 `feat/xxx` / `fix/xxx` / `refactor/xxx`。
3. **类型安全**：所有改动必须通过 `npm run build`（含 `tsc --noEmit` 级别检查），不要引入新的 `any`。
4. **权限收敛**：涉及 Tauri `capabilities/` 或 CSP 变更的，要在 PR 描述里说明为什么需要新权限，并尽量收敛到最小范围。
5. **提交信息**：沿用现有 conventional commits 风格（`feat:` / `fix:` / `refactor:` / `security:` 等）。
6. **不要提交**：`node_modules/`、`dist/`、`src-tauri/target/`、本地调试用的 `*.py` 脚本和测试产物（`.gitignore` 已排除，请勿手动 `git add -f`）。
7. **版本号**：若改动影响发布版本，需同步更新 `src/settings.ts` 的 `APP_VERSION`、`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 四处，保持一致。

## 免责声明

本项目仅供**个人学习、交流和技术研究**使用，不得用于任何商业用途。

- 本项目**不存储、不分发、不传播**任何在线音频、歌词或封面文件，所有在线内容均来自第三方公开网络服务，相关资源版权归原作者及各平台所有。
- 调用的在线接口（网易云音乐等）与第三方解析 API 的可用性、稳定性、合法性由其提供方负责，本项目对接口的可用性不作任何承诺，也不对因使用第三方接口产生的任何后果承担责任。
- 用户使用本项目产生的一切行为及法律后果，由使用者本人承担。请在遵守所在地区法律法规的前提下使用。
- 若版权权利人认为本项目存在侵权内容，请通过 issue 或邮件联系，确认后我们将及时处理。

**版权鸣谢**：本项目内置的第三方音乐搜索解析 API 由 **GD音乐台 (music.gdstudio.xyz)** 强力提供，感谢原作者的无私奉献与开源精神。

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。你可自由使用、修改、分发本代码，但请保留版权声明与许可声明。
