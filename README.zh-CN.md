# MCP BROWSER

**MCP BROWSER** 是一款开源 **Electron 桌面应用**，用于 **管理 MCP（Model Context Protocol）HTTP 服务端点**，并 **浏览工具列表**（`tools/list`）：名称、说明与 **`inputSchema`**（JSON）。

**作者 / 维护者：Guo's**

**仓库：** [github.com/unicorngithub/MCP-Browser](https://github.com/unicorngithub/MCP-Browser)

[English](README.md) | 简体中文

---

## 界面预览

配图基于 **[MCP Feature Reference Server](https://example-server.modelcontextprotocol.io/)** 的 **`https://example-server.modelcontextprotocol.io/debug/mcp`**（Debug MCP App，Streamable HTTP，无需 OAuth）。同域 **`/mcp`** 可能需鉴权，详见官网。

<p align="center">
  <img src="docs/images/app-window.png" alt="MCP BROWSER：主窗口侧栏与工具区" width="820" />
</p>

<p align="center"><em>主窗口：默认<strong>简体中文</strong>，侧栏可切换 <strong>EN / 中文</strong>；菜单栏与系统对话框与界面一致。已连接官方 Debug 示例 — 工具列表与详情（说明、<code>inputSchema</code>、工具测试）。</em></p>

<p align="center">
  <img src="docs/images/app-add-server.png" alt="MCP BROWSER：添加 MCP 地址弹窗（含可选自定义请求头）" width="820" />
</p>

<p align="center"><em>添加 / 编辑端点；可配置 <code>Authorization</code> 等请求头。</em></p>

---

## 功能概览

- **多地址管理**：增删改 MCP HTTP 端点；**electron-store** 本地持久化
- **协议流程**：**Streamable HTTP** 下 `initialize` → **`Mcp-Session-Id`** 会话 → `notifications/initialized` → **`tools/list`**
- **工具浏览**：列表 + 详情（含 `inputSchema`）
- **中英界面**：渲染进程 **react-i18next**；菜单栏与原生对话框经 preload（`appLocale`）与 `shared/appShellStrings.ts` 与界面同步
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

打包（安装包与平台相关，建议在目标系统执行）：

```bash
pnpm build
```

仅输出解包目录（如 `release/<版本>/win-unpacked/`，不生成 NSIS）：

```bash
pnpm run build:dir
```

清理后完整重编：

```bash
pnpm clean
pnpm rebuild   # clean 后再 build
```

### 使用 pnpm 时

若 Electron 安装或启动异常，请确认 `package.json` 中 `pnpm.onlyBuiltDependencies` 包含 `electron`、`esbuild`，删除 `node_modules` 后重新安装。

## macOS：无法打开或提示「已损坏」

预构建安装包 **未经过 Apple 公证**。系统可能拦截启动，或提示 **「应用已损坏，无法打开」** —— 多数是 **门禁（Gatekeeper）与隔离属性（quarantine）** 导致，并非文件真的损坏。

### 1. 系统设置中的安全性

1. 点击屏幕左上角 **苹果菜单**（）> **系统设置**（macOS Monterey 及更早为 **系统偏好设置**）。
2. 打开 **隐私与安全性**（较早版本为 **安全性与隐私**）。
3. 在 **安全性**（或「允许从以下位置下载的应用」）中，若出现 **任何来源**，请选中；若仅有「App Store」或「App Store 与已知开发者」，可继续下一步。

### 2. 未显示「任何来源」时

在「终端」中以管理员身份全局放宽门禁（慎用，用毕可恢复）：

```bash
sudo spctl --master-disable
```

恢复默认策略：

```bash
sudo spctl --master-enable
```

### 3. 移除该应用的隔离标记

对**已安装**的 `.app` 删除 `com.apple.quarantine` 扩展属性，可消除多数误报的「已损坏」提示：

```bash
sudo xattr -r -d com.apple.quarantine /Applications/MCP\ BROWSER.app
```

若应用不在 `/Applications`，请改为实际路径（例如 `~/Applications/MCP BROWSER.app`）。

### 命令对照

| 命令 | 作用范围 | 典型用途 |
|------|----------|----------|
| `sudo xattr -r -d com.apple.quarantine <.app 路径>` | **单个应用** | 仅清除该套件的隔离标记；在信任该应用的前提下优先使用。 |
| `sudo spctl --master-disable` | **整个系统** | 全局允许未签名 / 未公证应用，直至执行 `master-enable`；适合临时排障，不建议长期开启。 |

## 目录结构

```text
├── build/             electron-builder 用图标（`icon.png`、`.ico` / `.icns`）
├── docs/images/       README 截图；非 Linux 可用 `pnpm test:update-screenshots` 更新
├── electron/          主进程、preload、IPC、MCP 客户端
├── public/            静态资源
├── scripts/           辅助脚本（如 `clean.mjs`）
├── shared/            共享类型、语言与主进程文案等
├── src/               React 界面与状态
├── dist/              Vite 构建产物
└── dist-electron/     Electron 主进程与 preload 构建产物
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发：Vite + Electron |
| `pnpm build` | 类型检查 + Vite + electron-builder |
| `pnpm run build:dir` | 仅解包目录（`electron-builder --dir`） |
| `pnpm clean` | 删除 `dist/`、`dist-electron/`、`release/`、`node_modules/.vite` |
| `pnpm rebuild` | `clean` 后 `build` |
| `pnpm test` | Vitest（E2E 需外网；Linux 跳过；**不**覆盖 README 配图） |
| `pnpm test:update-screenshots` | 刷新 `docs/images/*.png` 等 |
| `pnpm preview` | 预览 Vite 构建后的渲染进程 |

## 安全说明

- 已启用 **contextIsolation**；preload 仅暴露受限 API（`mcpDesktop`、`updaterIpc`）
- MCP **HTTP 请求在主进程** 发起，避免渲染进程 CORS 限制

## 开源协议

**MIT**，全文见 [LICENSE](LICENSE)；著作权人为 **Guo's**。

再分发二进制或源码集合时，请按依赖许可证要求一并保留 **LICENSE** 与 **[NOTICE](NOTICE)**（内含第三方许可与声明义务汇总）。

## 参考

- **[Model Context Protocol](https://modelcontextprotocol.io)** — 本客户端所对接的公开协议与文档。

各 npm 依赖遵循各自许可证；细节见包内说明及 **NOTICE**。
