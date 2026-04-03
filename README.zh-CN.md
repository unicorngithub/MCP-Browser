# MCP BROWSER

**MCP BROWSER** 是一款开源的 **Electron 桌面应用**，用于 **管理 MCP（Model Context Protocol）HTTP 服务端点**，并 **浏览工具列表**（`tools/list`），展示工具名称、说明及 **`inputSchema`**（JSON）。

**开发者 / 维护者：Guo's**（开源项目）。

**仓库：** [github.com/unicorngithub/MCP-Browser](https://github.com/unicorngithub/MCP-Browser)

[English](README.md) | 简体中文

---

## 功能概览

- **多地址管理**：添加、编辑、删除 MCP HTTP 端点；使用 **electron-store** 本地持久化
- **协议对齐**：按 **Streamable HTTP** 流程发起 `initialize`、维护 **`Mcp-Session-Id` 会话**、发送 `notifications/initialized`，再请求 **`tools/list`**
- **工具浏览**：列表 + 详情（含 `inputSchema` 格式化展示）
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
├── electron/          主进程、preload、IPC、MCP 客户端
├── public/            静态资源（favicon、`icon.png` 供窗口图标等）
├── scripts/           辅助脚本（如 `clean.mjs`）
├── shared/            前后端共享类型
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
| `pnpm test` | Vitest（含 Electron 冒烟 E2E） |
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
