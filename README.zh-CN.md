# MCP BROWSER

**MCP BROWSER** 是一款开源的 **Electron 桌面应用**，用于 **管理 MCP（Model Context Protocol）HTTP 服务端点**，并 **浏览工具列表**（`tools/list`），展示工具名称、说明及 **`inputSchema`**（JSON）。

**开发者 / 维护者：Guo's**（开源项目）。

**仓库：** [github.com/unicorngithub/MCP-Browser](https://github.com/unicorngithub/MCP-Browser)

[English](README.md) | 简体中文

---

## 界面预览

README 配图使用 **[MCP Feature Reference Server](https://example-server.modelcontextprotocol.io/)** 上的 **`https://example-server.modelcontextprotocol.io/debug/mcp`**（Debug MCP App，Streamable HTTP，**无需 OAuth**）。同一域名下的根路径 **`/mcp`** 可能需要鉴权，详见官网说明。

<p align="center">
  <img src="docs/images/app-window.png" alt="MCP BROWSER：主窗口侧栏与工具区" width="820" />
</p>

<p align="center"><em>主窗口：界面默认<strong>简体中文</strong>，侧栏可切换 <strong>EN / 中文</strong>；菜单栏与系统文件对话框语言与界面一致。下图已连接官方 Debug 示例端点 — 左侧工具列表、右侧工具详情（说明、<code>inputSchema</code>、工具测试）。</em></p>

<p align="center">
  <img src="docs/images/app-add-server.png" alt="MCP BROWSER：添加 MCP 地址弹窗（含可选自定义请求头）" width="820" />
</p>

<p align="center"><em>添加 / 编辑端点；可配置 <code>Authorization</code> 等 HTTP 请求头（配图为中文界面）。</em></p>

---

## 功能概览

- **多地址管理**：添加、编辑、删除 MCP HTTP 端点；使用 **electron-store** 本地持久化
- **协议对齐**：按 **Streamable HTTP** 流程发起 `initialize`、维护 **`Mcp-Session-Id` 会话**、发送 `notifications/initialized`，再请求 **`tools/list`**
- **工具浏览**：列表 + 详情（含 `inputSchema` 格式化展示）
- **中英界面**：渲染进程 **react-i18next**；侧栏切换语言后，**菜单栏**与导入/导出等**原生对话框**通过 preload（`appLocale`）与主进程 `shared/appShellStrings.ts` 同步文案
- **技术栈**：React 18、TypeScript、Vite、Tailwind CSS、Zustand

## 环境要求

- **Node.js** 18+（推荐 20 LTS）
- **pnpm** 或 npm

## 快速开始

```bash
git clone https://github.com/unicorngithub/MCP-Browser.git
cd MCP-Browser
pnpm install
pnpm dev
```

打包发布（安装包与平台相关，建议在目标系统上执行）：

```bash
pnpm build
```

若仅需**绿色版目录**（如 `release/<版本>/win-unpacked/`，不生成 NSIS 安装包，可避免部分环境下安装器依赖下载失败）：

```bash
pnpm run build:dir
```

清理 `dist/`、`dist-electron/`、`release/` 与 Vite 缓存后完整重编：

```bash
pnpm clean
pnpm rebuild   # 等同于 clean 后再 build
```

### 使用 pnpm 时的说明

若 Electron 安装或启动异常，请确认 `package.json` 中已配置 `pnpm.onlyBuiltDependencies`（包含 `electron`、`esbuild`），删除 `node_modules` 后重新 `pnpm install`。

## 目录结构

```text
├── build/             electron-builder 用应用图标（`icon.png`，以及生成的 `.ico` / `.icns`）
├── docs/images/       README 截图（`app-window.png`、`app-add-server.png`；非 Linux 下用 `pnpm test:update-screenshots` 更新，普通 `pnpm test` 不会覆盖）
├── electron/          主进程、preload、IPC、MCP 客户端
├── public/            静态资源（favicon、`icon.png` 供窗口图标等）
├── scripts/           辅助脚本（如 `clean.mjs`）
├── shared/            共享类型、语言与主进程菜单/对话框文案（`appShellStrings.ts`、MCP IPC 常量等）
├── src/               React 渲染进程（界面与状态）
├── dist/              Vite 前端构建产物
└── dist-electron/     Electron 主进程与 preload 构建产物
```

## 常用命令

| 命令 | 说明 |
| ---- | ---- |
| `pnpm dev` | 开发：Vite + Electron |
| `pnpm build` | 类型检查 + Vite + electron-builder（按配置生成安装包等） |
| `pnpm run build:dir` | 类型检查 + Vite + 仅输出解包目录（`electron-builder --dir`） |
| `pnpm clean` | 删除 `dist/`、`dist-electron/`、`release/`、`node_modules/.vite` |
| `pnpm rebuild` | 先 `clean` 再执行 `pnpm build` |
| `pnpm test` | Vitest（E2E 会请求官方 **Debug MCP** 演示端点，需外网；Linux 下跳过；**不会**改写 README 配图） |
| `pnpm test:update-screenshots` | 与测试流程相同，但会设置 `MCP_BROWSER_UPDATE_SCREENSHOTS=1`，刷新 `docs/images/*.png` 与 `test/screenshots/e2e.png` |
| `pnpm preview` | 预览 Vite 构建后的渲染进程 |

## 安全说明

- 已开启 **contextIsolation**；preload 仅暴露受限 API（`mcpDesktop`、`updaterIpc`），不暴露完整 `ipcRenderer`
- 对 MCP 的 **HTTP 请求在主进程** 执行，避免渲染进程 CORS 限制

## 开源协议

**MIT**，全文见 [LICENSE](LICENSE)；其中著作权声明为 **Guo's**（本仓库整体交付部分）。

来自上游脚手架 **electron-vite-react**（MIT，**© 草鞋没号**）的署名与说明见 [NOTICE](NOTICE)。再分发时请**同时保留** `LICENSE` 与 `NOTICE`（按你的发布形式放在合适位置）。

## 致谢与第三方

- **[Model Context Protocol](https://modelcontextprotocol.io)** — 公开协议与文档（本客户端实现与之对接）。
- **[electron-vite-react](https://github.com/electron-vite/electron-vite-react)** — 上游 Electron + Vite + React 脚手架（MIT）。
- **Electron、Vite、React** 等 npm 生态组件 — 各自许可证见对应包内说明（`node_modules`）。

若你打包再分发应用，请按各依赖许可证要求一并保留其需要的声明与许可文本。
